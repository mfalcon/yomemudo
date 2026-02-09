(function($) {
    'use strict';

    // ===== CONSTANTS =====
    var CABA_CENTER = [-34.6169, -58.4473];
    var CABA_ZOOM = 12;
    var LAT_MIN = -34.705, LAT_MAX = -34.535;
    var LON_MIN = -58.531, LON_MAX = -58.335;
    var GRID_ROWS = 15, GRID_COLS = 14;
    var TOP_N = 12;
    var API_CONCURRENCY = 3;
    var USIG_ROUTING_URL = 'https://recorridos.usig.buenosaires.gob.ar/2.0/consultar_recorridos';
    var USIG_CONVERT_URL = 'https://ws.usig.buenosaires.gob.ar/rest/convertir_coordenadas';

    // Simplified CABA boundary polygon (lat, lon pairs)
    var CABA_POLYGON = [
        [-34.535, -58.462], [-34.543, -58.440], [-34.546, -58.395],
        [-34.555, -58.365], [-34.570, -58.345], [-34.590, -58.335],
        [-34.615, -58.340], [-34.640, -58.345], [-34.660, -58.365],
        [-34.680, -58.385], [-34.695, -58.415], [-34.705, -58.445],
        [-34.700, -58.470], [-34.690, -58.500], [-34.670, -58.530],
        [-34.645, -58.531], [-34.620, -58.525], [-34.595, -58.515],
        [-34.570, -58.505], [-34.555, -58.490], [-34.545, -58.475],
        [-34.535, -58.462]
    ];

    var RESULT_COLORS = ['#1EBE39', '#55C768', '#80CA8C', '#A8D8B0', '#C8E6C9'];

    // ===== STATE =====
    var map, heatLayer, tileLayer;
    var resultLayers = [];
    var gridPoints = [];
    var destinations = []; // [{usigX, usigY, lat, lon, days, direction, transport, ready}]
    var destinationCount = 1;

    // ===== GEOMETRY =====

    function haversine(lat1, lon1, lat2, lon2) {
        var R = 6367;
        var dLat = (lat2 - lat1) * Math.PI / 180;
        var dLon = (lon2 - lon1) * Math.PI / 180;
        var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
        var c = 2 * Math.asin(Math.sqrt(a));
        return R * c;
    }

    function pointInPolygon(lat, lon, polygon) {
        var inside = false;
        for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            var yi = polygon[i][0], xi = polygon[i][1];
            var yj = polygon[j][0], xj = polygon[j][1];
            if (((yi > lat) !== (yj > lat)) &&
                (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        return inside;
    }

    function boundingRectangle(lat, lon, meters) {
        var r = 6378137;
        var dLat = meters / r;
        var dLon = meters / (r * Math.cos(Math.PI * lat / 180));
        return {
            ne: [lat + dLat * 180 / Math.PI, lon + dLon * 180 / Math.PI],
            sw: [lat - dLat * 180 / Math.PI, lon - dLon * 180 / Math.PI]
        };
    }

    // ===== GRID GENERATION =====

    function generateGrid() {
        var points = [];
        var latStep = (LAT_MAX - LAT_MIN) / GRID_ROWS;
        var lonStep = (LON_MAX - LON_MIN) / GRID_COLS;

        for (var r = 0; r <= GRID_ROWS; r++) {
            for (var c = 0; c <= GRID_COLS; c++) {
                var lat = LAT_MIN + r * latStep;
                var lon = LON_MIN + c * lonStep;
                if (pointInPolygon(lat, lon, CABA_POLYGON)) {
                    points.push({ lat: lat, lon: lon, id: points.length });
                }
            }
        }
        return points;
    }

    // ===== COORDINATE CONVERSION =====

    function usigToLatLon(x, y) {
        var deferred = $.Deferred();
        $.ajax({
            url: USIG_CONVERT_URL,
            dataType: 'jsonp',
            data: { x: x, y: y, output: 'lonlat' },
            success: function(data) {
                if (data && data.resultado) {
                    deferred.resolve({
                        lat: parseFloat(data.resultado.y),
                        lon: parseFloat(data.resultado.x)
                    });
                } else {
                    deferred.reject('Invalid conversion response');
                }
            },
            error: function() {
                deferred.reject('Conversion API error');
            },
            timeout: 10000
        });
        return deferred.promise();
    }

    function latLonToUsig(lat, lon) {
        var deferred = $.Deferred();
        $.ajax({
            url: USIG_CONVERT_URL,
            dataType: 'jsonp',
            data: { x: lon, y: lat, output: 'gkba' },
            success: function(data) {
                if (data && data.resultado) {
                    deferred.resolve({
                        x: data.resultado.x,
                        y: data.resultado.y
                    });
                } else {
                    deferred.reject('Invalid conversion response');
                }
            },
            error: function() {
                deferred.reject('Conversion API error');
            },
            timeout: 10000
        });
        return deferred.promise();
    }

    // ===== USIG ROUTING API =====

    function parseRouteSummary(plan) {
        var legs = [];
        var summary = plan.summary || [];

        for (var i = 0; i < summary.length; i++) {
            var s = summary[i];
            if (s.type === 'Board') {
                var leg = { type: 'board' };
                if (s.service_type === 3 || s.service_type === '3') {
                    leg.mode = 'colectivo';
                    leg.line = s.service;
                    leg.label = 'Colectivo ' + s.service;
                } else if (s.service_type === 1 || s.service_type === '1') {
                    leg.mode = 'subte';
                    leg.line = s.service;
                    leg.label = 'Subte ' + s.service.replace('Línea ', '');
                } else if (s.service_type === 2 || s.service_type === '2') {
                    leg.mode = 'tren';
                    leg.line = s.service;
                    leg.label = 'Tren ' + s.service;
                }
                if (s.stop_name) leg.stop = s.stop_name;
                if (s.calle1 && s.calle2) leg.where = s.calle1 + ' y ' + s.calle2;
                if (s.tiempo_estimado) leg.estimatedTime = s.tiempo_estimado;
                legs.push(leg);
            } else if (s.type === 'Alight') {
                var alight = { type: 'alight' };
                if (s.stop_name) alight.stop = s.stop_name;
                if (s.calle1 && s.calle2) alight.where = s.calle1 + ' y ' + s.calle2;
                legs.push(alight);
            }
        }

        // Extract walking info from plan
        var totalWalk = plan.walk || 0;

        return {
            tiempo: plan.tiempo,
            legs: legs,
            walkMeters: Math.round(totalWalk),
            distance: plan.traveled_distance || 0,
            services: plan.services || '',
            tripType: plan.type || ''
        };
    }

    function formatDistanceStr(meters) {
        if (meters >= 1000) {
            return (meters / 1000).toFixed(1) + ' km';
        }
        return Math.round(meters) + ' m';
    }

    function formatRouteHtml(route) {
        if (!route || !route.legs) return '';

        var html = '<div class="route-detail">';

        // Time and distance summary line
        html += '<div class="route-meta">';
        html += '<strong>' + route.tiempo + ' min</strong>';
        if (route.distance > 0) {
            html += ' &middot; ' + formatDistanceStr(route.distance);
        }
        if (route.walkMeters > 0) {
            html += ' &middot; ' + formatDistanceStr(route.walkMeters) + ' caminando';
        }
        html += '</div>';

        // Transport legs detail
        html += '<div class="route-legs">';
        for (var i = 0; i < route.legs.length; i++) {
            var leg = route.legs[i];
            if (leg.type === 'board') {
                var modeClass = 'badge-' + leg.mode;
                html += '<span class="transport-badge ' + modeClass + '">' + leg.label + '</span>';
                if (leg.where) {
                    html += ' <small class="text-muted">en ' + leg.where + '</small>';
                }
            } else if (leg.type === 'alight') {
                if (leg.stop) {
                    html += ' <small class="text-muted">&rarr; est. ' + leg.stop + '</small>';
                } else if (leg.where) {
                    html += ' <small class="text-muted">&rarr; ' + leg.where + '</small>';
                }
            }
        }
        html += '</div>';

        html += '</div>';
        return html;
    }

    function getTransitTime(origX, origY, destX, destY, tipo) {
        var deferred = $.Deferred();
        $.ajax({
            url: USIG_ROUTING_URL,
            dataType: 'jsonp',
            data: {
                tipo: tipo,
                gml: false,
                precargar: 1,
                opciones_caminata: 800,
                opciones_medios_colectivo: true,
                opciones_medios_subte: true,
                opciones_medios_tren: true,
                opciones_prioridad: 'avenidas',
                opciones_incluir_autopistas: true,
                opciones_cortes: true,
                max_results: 1,
                origen: origX + ',' + origY,
                destino: destX + ',' + destY
            },
            success: function(data) {
                if (data && data.planning && data.planning.length > 0) {
                    try {
                        var plan = JSON.parse(data.planning[0]);
                        var route = parseRouteSummary(plan);
                        deferred.resolve(route);
                    } catch (e) {
                        deferred.resolve(null);
                    }
                } else {
                    deferred.resolve(null);
                }
            },
            error: function() {
                deferred.resolve(null);
            },
            timeout: 30000
        });
        return deferred.promise();
    }

    // ===== CONCURRENCY CONTROL =====

    function runWithConcurrency(tasks, concurrency) {
        var deferred = $.Deferred();
        var results = new Array(tasks.length);
        var index = 0;
        var completed = 0;

        function next() {
            if (index >= tasks.length) return;
            var i = index++;
            tasks[i]().then(function(result) {
                results[i] = result;
                completed++;
                if (completed === tasks.length) {
                    deferred.resolve(results);
                } else {
                    next();
                }
            });
        }

        var initial = Math.min(concurrency, tasks.length);
        for (var w = 0; w < initial; w++) {
            next();
        }

        if (tasks.length === 0) deferred.resolve([]);
        return deferred.promise();
    }

    // ===== PHASE 1: HAVERSINE HEATMAP =====

    function computeHaversineScores(dests) {
        var scores = [];
        for (var i = 0; i < gridPoints.length; i++) {
            var pt = gridPoints[i];
            var total = 0;
            for (var j = 0; j < dests.length; j++) {
                var d = dests[j];
                var km = haversine(pt.lat, pt.lon, d.lat, d.lon);
                var approxMinutes = km * 3.5; // rough avg transit speed
                var multiplier = d.days * (d.direction === 'idavta' ? 2 : 1);
                total += approxMinutes * multiplier;
            }
            scores.push({ index: i, score: total });
        }
        return scores;
    }

    function renderHeatmap(scores) {
        if (heatLayer) {
            map.removeLayer(heatLayer);
        }

        var maxScore = 0;
        for (var i = 0; i < scores.length; i++) {
            if (scores[i].score > maxScore) maxScore = scores[i].score;
        }
        if (maxScore === 0) maxScore = 1;

        var heatData = [];
        for (var i = 0; i < scores.length; i++) {
            var pt = gridPoints[scores[i].index];
            var intensity = 1 - (scores[i].score / maxScore);
            if (intensity > 0.05) {
                heatData.push([pt.lat, pt.lon, intensity]);
            }
        }

        heatLayer = L.heatLayer(heatData, {
            radius: 35,
            blur: 30,
            maxZoom: 15,
            max: 1.0,
            gradient: {
                0.0: 'transparent',
                0.2: '#ff4444',
                0.4: '#ff8800',
                0.6: '#ffcc00',
                0.8: '#88cc00',
                1.0: '#00aa00'
            }
        }).addTo(map);
    }

    // ===== PHASE 2: TRANSIT API SCORING =====

    function getTopCandidates(scores, n) {
        var sorted = scores.slice().sort(function(a, b) { return a.score - b.score; });
        return sorted.slice(0, n);
    }

    function computeTransitScores(candidates, dests, onProgress) {
        var deferred = $.Deferred();
        var totalCalls = candidates.length * dests.length;
        var completedCalls = 0;

        // First: convert all candidate lat/lon to USIG x,y
        var conversionTasks = candidates.map(function(cand) {
            return function() {
                return latLonToUsig(gridPoints[cand.index].lat, gridPoints[cand.index].lon);
            };
        });

        onProgress('Convirtiendo coordenadas...', 0, totalCalls);

        runWithConcurrency(conversionTasks, API_CONCURRENCY).then(function(usigCoords) {
            // Now make routing calls for each candidate-destination pair
            var routingTasks = [];
            var taskMap = []; // {candIdx, destIdx}

            for (var c = 0; c < candidates.length; c++) {
                if (!usigCoords[c]) continue;
                for (var d = 0; d < dests.length; d++) {
                    (function(ci, di, coords) {
                        routingTasks.push(function() {
                            return getTransitTime(
                                coords.x, coords.y,
                                dests[di].usigX, dests[di].usigY,
                                dests[di].transport
                            ).then(function(route) {
                                completedCalls++;
                                onProgress('Consultando rutas...', completedCalls, totalCalls);
                                return { candIdx: ci, destIdx: di, route: route };
                            });
                        });
                        taskMap.push({ candIdx: ci, destIdx: di });
                    })(c, d, usigCoords[c]);
                }
            }

            runWithConcurrency(routingTasks, API_CONCURRENCY).then(function(routeResults) {
                // Aggregate times and routes per candidate
                var candData = {};
                for (var i = 0; i < routeResults.length; i++) {
                    var r = routeResults[i];
                    if (!r || r.route === null) continue;
                    var key = r.candIdx;
                    if (!candData[key]) candData[key] = { totalMinutes: 0, trips: [] };
                    var dest = dests[r.destIdx];
                    var multiplier = dest.days * (dest.direction === 'idavta' ? 2 : 1);
                    candData[key].totalMinutes += r.route.tiempo * multiplier;
                    candData[key].trips.push({
                        destName: dest.name || ('Destino ' + (r.destIdx + 1)),
                        route: r.route,
                        days: dest.days,
                        direction: dest.direction
                    });
                }

                // Build results
                var results = [];
                for (var key in candData) {
                    var idx = candidates[parseInt(key)].index;
                    var pt = gridPoints[idx];
                    results.push({
                        lat: pt.lat,
                        lon: pt.lon,
                        totalMinutes: candData[key].totalMinutes,
                        trips: candData[key].trips
                    });
                }

                results.sort(function(a, b) { return a.totalMinutes - b.totalMinutes; });
                deferred.resolve(results);
            });
        });

        return deferred.promise();
    }

    // ===== RESULTS DISPLAY =====

    function clearResults() {
        for (var i = 0; i < resultLayers.length; i++) {
            map.removeLayer(resultLayers[i]);
        }
        resultLayers = [];
        $('#results-panel').empty();
    }

    function formatTimeStr(minutes) {
        var hours = Math.floor(minutes / 60);
        var mins = Math.round(minutes % 60);
        return hours > 0 ? hours + 'h ' + mins + 'min' : mins + ' min';
    }

    function renderResults(results) {
        var panel = $('#results-panel');
        panel.empty();

        if (results.length === 0) {
            panel.html('<div class="alert alert-warning">No se encontraron resultados.</div>');
            return;
        }

        panel.append('<h4 style="margin-top:5px">Mejores zonas:</h4>');

        var top = results.slice(0, 5);
        for (var i = 0; i < top.length; i++) {
            var r = top[i];
            var color = RESULT_COLORS[i] || RESULT_COLORS[RESULT_COLORS.length - 1];
            var timeStr = formatTimeStr(r.totalMinutes);

            // Build trip details HTML
            var tripsHtml = '';
            if (r.trips && r.trips.length > 0) {
                for (var t = 0; t < r.trips.length; t++) {
                    var trip = r.trips[t];
                    tripsHtml += '<div class="trip-detail">';
                    tripsHtml += '<div class="trip-dest">&rarr; ' + trip.destName + '</div>';
                    tripsHtml += formatRouteHtml(trip.route);
                    tripsHtml += '</div>';
                }
            }

            // Result card in sidebar
            panel.append(
                '<div class="result-card">' +
                    '<div class="result-header" style="background:' + color + '">' +
                        '#' + (i + 1) + ' &mdash; ' + timeStr + ' por semana' +
                    '</div>' +
                    '<div class="result-trips">' + tripsHtml + '</div>' +
                '</div>'
            );

            // Circle on map
            var circle = L.circle([r.lat, r.lon], {
                radius: 800,
                color: color,
                fillColor: color,
                fillOpacity: 0.3,
                weight: 2
            }).addTo(map);

            // Popup with trip details and property search link
            var mlUrl = 'https://inmuebles.mercadolibre.com.ar/departamentos/' +
                '_DisplayType_M#D[lat:' + r.lat + ',long:' + r.lon + ',zoom:15]';

            var popupHtml = '<strong>Zona #' + (i + 1) + '</strong><br>' +
                'Tiempo semanal: <strong>' + timeStr + '</strong><br>';

            if (r.trips && r.trips.length > 0) {
                popupHtml += '<hr style="margin:5px 0">';
                for (var t = 0; t < r.trips.length; t++) {
                    var trip = r.trips[t];
                    popupHtml += '<div style="margin:4px 0">';
                    popupHtml += '<strong>' + trip.destName + '</strong><br>';
                    popupHtml += '<span style="font-size:13px">' + trip.route.tiempo + ' min';
                    if (trip.route.distance > 0) {
                        popupHtml += ' &middot; ' + formatDistanceStr(trip.route.distance);
                    }
                    popupHtml += '</span><br>';
                    // Show transport modes
                    for (var l = 0; l < trip.route.legs.length; l++) {
                        var leg = trip.route.legs[l];
                        if (leg.type === 'board') {
                            popupHtml += '<span class="popup-badge popup-' + leg.mode + '">' + leg.label + '</span> ';
                        }
                    }
                    if (trip.route.walkMeters > 0) {
                        popupHtml += '<br><small>' + formatDistanceStr(trip.route.walkMeters) + ' caminando</small>';
                    }
                    popupHtml += '</div>';
                }
            }

            popupHtml += '<hr style="margin:5px 0">';
            popupHtml += '<a href="' + mlUrl + '" target="_blank">Ver propiedades en Mercado Libre</a>';

            circle.bindPopup(popupHtml, { maxWidth: 350 });
            resultLayers.push(circle);
        }
    }

    // ===== AUTOCOMPLETER SETUP =====

    function createAutoCompleter(inputId, idx) {
        var ac = new usig.AutoCompleter(inputId, {
            debug: false,
            rootUrl: 'https://servicios.usig.buenosaires.gob.ar/usig-js/3.1/',
            afterSelection: function(option) {
                if (option instanceof usig.Direccion || option instanceof usig.inventario.Objeto) {
                    if (!destinations[idx]) destinations[idx] = {};
                    destinations[idx].selected = option;
                }
            },
            afterGeoCoding: function(pt) {
                if (pt instanceof usig.Punto) {
                    if (!destinations[idx]) destinations[idx] = {};
                    destinations[idx].usigX = pt.x;
                    destinations[idx].usigY = pt.y;
                    destinations[idx].ready = false;

                    // Convert USIG coords to lat/lon for haversine
                    usigToLatLon(pt.x, pt.y).then(function(result) {
                        destinations[idx].lat = result.lat;
                        destinations[idx].lon = result.lon;
                        destinations[idx].ready = true;
                    }).fail(function() {
                        // Fallback: try to use the punto values directly
                        // (they may or may not be actual lat/lon)
                        destinations[idx].ready = false;
                    });
                }
            }
        });
        return ac;
    }

    // ===== UI HANDLERS =====

    function collectDestinations() {
        var dests = [];
        var elements = $('div.destino-block');

        elements.each(function(i) {
            var idx = i;
            if (destinations[idx] && destinations[idx].ready) {
                var $block = $(this);
                var inputVal = $block.find('input[name="d"]').val() || ('Destino ' + (i + 1));
                dests.push({
                    usigX: destinations[idx].usigX,
                    usigY: destinations[idx].usigY,
                    lat: destinations[idx].lat,
                    lon: destinations[idx].lon,
                    days: parseInt($block.find('.dds').val()),
                    direction: $block.find('.sd').val(),
                    transport: $block.find('.ttrans').val(),
                    name: inputVal
                });
            }
        });

        return dests;
    }

    function showLoading(msg) {
        $('#loading-message').text(msg || 'Calculando zonas con menor tiempo de viaje...');
        $('#loading-progress').text('');
        $('.loading-overlay').show();
    }

    function updateProgress(msg, current, total) {
        $('#loading-message').text(msg);
        if (total > 0) {
            $('#loading-progress').text(current + ' / ' + total);
        }
    }

    function hideLoading() {
        $('.loading-overlay').hide();
    }

    // ===== MAIN SEARCH =====

    function onBuscar() {
        var dests = collectDestinations();

        if (dests.length === 0) {
            // Check if there are destinations still loading
            var hasSelected = false;
            for (var k in destinations) {
                if (destinations[k] && destinations[k].usigX) {
                    hasSelected = true;
                    break;
                }
            }
            if (hasSelected) {
                // Still converting coordinates, retry in a moment
                showLoading('Esperando geocodificacion...');
                setTimeout(function() {
                    hideLoading();
                    onBuscar();
                }, 1500);
                return;
            }
            $('#results-panel').html(
                '<div class="alert alert-info" style="margin-top:10px">' +
                'Seleccione al menos un destino del autocompletado.' +
                '</div>'
            );
            return;
        }

        clearResults();
        showLoading('Calculando mapa de calor...');

        // Phase 1: instant haversine heatmap
        setTimeout(function() {
            var scores = computeHaversineScores(dests);
            renderHeatmap(scores);

            // Phase 2: transit API for top candidates
            var candidates = getTopCandidates(scores, TOP_N);

            updateProgress('Consultando tiempos de transporte...', 0, candidates.length * dests.length);

            computeTransitScores(candidates, dests, function(msg, current, total) {
                updateProgress(msg, current, total);
            }).then(function(results) {
                renderResults(results);
                hideLoading();

                // Fit map to show results if we have them
                if (results.length > 0) {
                    var bounds = L.latLngBounds(results.map(function(r) {
                        return [r.lat, r.lon];
                    }));
                    map.fitBounds(bounds.pad(0.3));
                }
            });
        }, 50); // small delay so loading overlay renders
    }

    // ===== INITIALIZATION =====

    function initMap() {
        map = L.map('mapid').setView(CABA_CENTER, CABA_ZOOM);
        tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19
        }).addTo(map);
    }

    function initUI() {
        $('#mainForm').on('submit', function(e) {
            e.preventDefault();
            return false;
        });

        $('#agregar').on('click', function(ev) {
            ev.preventDefault();
            var $last = $('div.destino-block:last');
            var num = parseInt($last.prop('id').match(/\d+/), 10) + 1;

            if (num >= 5) {
                $('#agregar').hide();
            }

            var $clone = $last.clone().prop('id', 'destino' + num);
            $clone.find('input').prop('id', 'd' + num).val('');
            $clone.find('.dds').prop('id', 'dds' + num);
            $clone.find('.sd').prop('id', 'sd' + num);
            $clone.find('.ttrans').prop('id', 'ttrans' + num);

            // Add remove button
            if (!$clone.find('.remove-dest').length) {
                $clone.prepend('<span class="remove-dest" title="Quitar destino">&times;</span>');
            }

            $clone.appendTo('.destinos');
            createAutoCompleter('d' + num, num - 1);
            destinationCount = num;
        });

        // Remove destination handler (delegated)
        $(document).on('click', '.remove-dest', function() {
            var $block = $(this).closest('.destino-block');
            var idx = $block.index();
            destinations[idx] = null;
            $block.remove();

            // Show agregar button again if under 4
            if ($('div.destino-block').length < 4) {
                $('#agregar').show();
            }
        });

        $('#buscar').on('click', function(ev) {
            ev.preventDefault();
            onBuscar();
        });
    }

    // ===== ENTRY POINT =====

    $(document).ready(function() {
        initMap();
        gridPoints = generateGrid();
        createAutoCompleter('d1', 0);
        initUI();
    });

})(jQuery);
