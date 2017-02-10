if (typeof(usig) == "undefined") {
    usig = {}
}
if (typeof(usig.defaults) == "undefined") {
    usig.defaults = {}
}
usig.TripTemplate = function(b, a) {
    this.index = b;
    this.color = a;
    this.cls = "trip_" + b
};
usig.defaults.Recorridos = {
    debug: false,
    trackVisits: true,
    //piwikBaseUrl: "//usig.buenosaires.gob.ar/piwik/",
    piwikBaseUrl: "http://usig.buenosaires.gob.ar/piwik/",
    piwikSiteId: 4,
    //server: "//recorridos.usig.buenosaires.gob.ar/2.0/",
    server: "https://recorridos.usig.buenosaires.gob.ar/2.0/",
    serverTimeout: 30000,
    maxRetries: 2,
    lang: "es",
    consultaRecorridos: {
        tipo: "transporte",
        gml: true,
        precargar: 3,
        opciones_caminata: 800,
        opciones_medios_colectivo: true,
        opciones_medios_subte: true,
        opciones_medios_tren: true,
        opciones_prioridad: "avenidas",
        opciones_incluir_autopistas: true,
        opciones_cortes: true,
        max_results: 10
    },
    colorTemplates: [new usig.TripTemplate(1, "#0074FF"), new usig.TripTemplate(2, "#DD0083"), new usig.TripTemplate(3, "#009866"), new usig.TripTemplate(4, "#FF9E29"), new usig.TripTemplate(5, "#FF6633"), new usig.TripTemplate(6, "#5B3BA1"), new usig.TripTemplate(7, "#98C93C"), new usig.TripTemplate(8, "#EE3A39"), new usig.TripTemplate(9, "#4ED5F9"), new usig.TripTemplate(10, "#FFCC05"), new usig.TripTemplate(11, "#84004F"), new usig.TripTemplate(12, "#00A5EB"), new usig.TripTemplate(13, "#016406"), new usig.TripTemplate(14, "#AB62D2"), new usig.TripTemplate(15, "#C49F25"), new usig.TripTemplate(16, "#9F2510"), new usig.TripTemplate(17, "#0003CF"), new usig.TripTemplate(18, "#CBA4FA"), new usig.TripTemplate(19, "#00FFC9"), new usig.TripTemplate(20, "#DC6767")]
};
usig.Recorridos = (function(a) {
    return new(usig.AjaxComponent.extend({
        lastRequest: null,
        init: function(c) {
            var d = a.extend({}, usig.defaults.Recorridos, c);
            d.consultaRecorridos = a.extend({}, usig.defaults.Recorridos.consultaRecorridos, c);
            this._super("Recorridos", usig.defaults.Recorridos.server, d);
            var b = function(e) {
                try {
                    var g = Piwik.getTracker(d.piwikBaseUrl + "piwik.php", e);
                    g.trackPageView();
                    g.enableLinkTracking()
                } catch (f) {}
            };
            if (usig.Recorridos && d.trackVisits) {
                if (typeof(Piwik) == "undefined") {
                    usig.loadJs(d.piwikBaseUrl + "piwik.js", b.createDelegate(this, [d.piwikSiteId]))
                } else {
                    b(d.piwikSiteId)
                }
            }
            return this
        },
        getUbicacion: function(b) {
            var c = {
                coordenadas: {
                    x: 0,
                    y: 0
                },
                codigo_calle: 0,
                altura: 0,
                codigo_calle2: 0
            };
            if (b.x != undefined && b.y != undefined) {
                c.coordenadas = b
            }
            if (usig.Direccion && b instanceof usig.Direccion) {
                if (b.getTipo() == usig.Direccion.CALLE_Y_CALLE) {
                    c.codigo_calle2 = b.getCalleCruce().codigo
                }
                c.coordenadas = b.getCoordenadas();
                c.codigo_calle = b.getCalle().codigo;
                c.altura = b.getAltura()
            }
            if (usig.inventario && usig.inventario.Objeto && b instanceof usig.inventario.Objeto) {
                if (b.direccionAsociada) {
                    c.coordenadas = b.direccionAsociada.getCoordenadas();
                    c.codigo_calle = b.direccionAsociada.getCalle().codigo;
                    c.altura = b.direccionAsociada.getAltura()
                } else {
                    c.coordenadas = b.ubicacion.getCentroide()
                }
            }
            if (usig.DireccionMapabsas && b instanceof usig.DireccionMapabsas) {
                if (b.tipo == usig.Direccion.CALLE_Y_CALLE) {
                    c.codigo_calle2 = b.cod_calle_cruce
                }
                c.codigo_calle = b.cod;
                c.altura = b.alt
            }
            return c
        },
        onBuscarRecorridosSuccess: function(d, f) {
            var b = [],
                c = this.opts.colorTemplates,
                e = this.opts.lang;
            if (this.opts.debug) {
                usig.debug("usig.Recorridos onBuscarRecorridosSuccess")
            }
            a.each(d.planning, function(h, j) {
                var g = JSON.parse(j);
                switch (g.type) {
                    case "car":
                        template = c[1];
                        break;
                    case "bike":
                        template = c[0];
                        break;
                    case "walk":
                        template = c[2];
                        break;
                    case "transporte_publico":
                        template = c[h];
                        break
                }
                b.push(new usig.Recorrido(JSON.parse(j), {
                    template: template,
                    lang: e
                }))
            });
            if (typeof(f) == "function") {
                f(b)
            }
        },
        loadTripPlan: function(c, d, b) {
            this.lastRequest = this.mkRequest(c, d, b, this.opts.server + "load_plan")
        },
        consultarRecorridos: function(d, c, e, b) {
            this.lastRequest = this.mkRequest(d, e, b, this.opts.server + "recorridos_" + c)
        },
        InfoTransporte: function(c, d, b) {
            this.lastRequest = this.mkRequest(c, d, b, this.opts.server + "info_transporte/")
        },
        buscarRecorridos: function(e, d, h, c, b) {
            var f = a.extend({}, this.opts.consultaRecorridos, b);
            var g = this.getUbicacion(e);
            if (g.coordenadas) {
                f.origen = g.coordenadas.x + "," + g.coordenadas.y
            }
            f.origen_calles2 = g.codigo_calle2;
            f.origen_calles = g.codigo_calle;
            f.origen_calle_altura = g.altura;
            var j = this.getUbicacion(d);
            if (j.coordenadas) {
                f.destino = j.coordenadas.x + "," + j.coordenadas.y
            }
            f.destino_calles2 = j.codigo_calle2;
            f.destino_calles = j.codigo_calle;
            f.destino_calle_altura = j.altura;
            this.lastRequest = this.mkRequest(f, this.onBuscarRecorridosSuccess.createDelegate(this, [h], 1), c, this.opts.server + "consultar_recorridos")
        },
        cargarPlanRecorrido: function(f, e, c, b) {
            var d = a.extend({}, this.opts.consultaRecorridos, b);
            d.trip_id = f;
            d.tipo = "loadplan";
            this.lastRequest = this.mkRequest(d, e, c, this.opts.server + "consultar_recorridos")
        },
        transportesCercanos: function(e, f, c) {
            var b = this.getUbicacion(e);
            var d = {
                x: b.coordenadas.x,
                y: b.coordenadas.y
            };
            this.lastRequest = this.mkRequest(d, f, c, this.opts.server + "info_transporte/")
        },
        cicloviasCercanas: function(f, g, d, c) {
            var b = this.getUbicacion(f);
            var e = {
                lon: b.coordenadas.x,
                lat: b.coordenadas.y
            };
            if (c) {
                if (c.radio) {
                    e.radio = c.radio
                }
                if (c.cantidad) {
                    e.cantidad = c.cantidad
                }
            }
            this.lastRequest = this.mkRequest(e, g, d, this.opts.server + "ciclovias_cercanas/")
        }
    }))
})(jQuery);
if (typeof(usig) == "undefined") {
    usig = {}
}
if (typeof(usig.Recorrido) == "undefined") {
    usig.Recorrido = (function(a) {
        return function(w, j) {
            var v = 0,
                g = 0,
                u, y, f, l, e, B, q, k = "Sin datos",
                C = "Sin datos",
                x = [],
                m = [],
                h = 0,
                r = a.extend({}, usig.Recorrido.defaults, j);
            getServiceIcon = function(D) {
                var E = "";
                if (D == 0) {
                    E = "recorrido_pie"
                }
                if (D == 1) {
                    E = "recorrido_subte"
                }
                if (D == 2) {
                    E = "recorrido_tren"
                }
                if (D == 3) {
                    E = "recorrido_colectivo"
                }
                if (D == 4) {
                    E = "recorrido_bici"
                }
                return '<img src="' + r.icons[E] + '" width="20" height="20">'
            };

            function z() {
                var D = [];
                C = "";
                if (f == "transporte_publico") {
                    estadoAnterior = null;
                    a.each(l, function(E, G) {
                        if (G.type == "Board") {
                            if (estadoAnterior == "Alight") {
                                C += '<span class="icons-sprite icon-combinacion"></span>'
                            }
                            if (G.service_type == 3) {
                                C += '<div class="pill colectivo' + G.service + '"><div class="primero"><span class="segundo"></span></div> <span class="linea">' + G.service + "</span></div>";
                                D.push(G.service)
                            } else {
                                if (G.service_type == 1) {
                                    lineas = G.service.split("-");
                                    a.each(lineas, function(H, I) {
                                        C += '<div class="circlePill subte' + I + '"><span class="linea">' + I.replace("Premetro", "P") + "</span></div>"
                                    });
                                    D.push(G.service)
                                } else {
                                    if (G.service_type == 2) {
                                        var F = G.long_name ? G.long_name : G.service;
                                        C += '<div class="pill trenpill"><div class="primero"><span class="segundo"></span></div> <span class="linea" title="' + F + '">' + G.service.replace(/\./g, "") + "</span></div>";
                                        D.push(G.service)
                                    }
                                }
                            }
                            if (G.alertas) {
                                a.each(G.alertas, function(H, I) {
                                    if (I.idioma.toLowerCase() == r.lang.toLowerCase()) {
                                        m.push({
                                            mensaje: I.mensaje,
                                            service: I.service
                                        })
                                    }
                                })
                            }
                        }
                        estadoAnterior = G.type
                    });
                    k = D.join(", ")
                } else {
                    if (f == "walk") {
                        k = r.texts.descWalk;
                        a.each(l, function(E, F) {
                            if (F.type != undefined && F.type == "StartWalking") {
                                C += '<span class="icon-walk"></span><span class="descripcion">' + k + "</span>"
                            }
                        })
                    } else {
                        if (f == "car") {
                            k = r.texts.descCar;
                            a.each(l, function(E, F) {
                                if (F.type != undefined && F.type == "StartDriving") {
                                    C += '<span class="icon-car"></span><span class="descripcion">' + k + "</span>"
                                }
                            })
                        } else {
                            if (f == "bike") {
                                k = r.texts.descBike;
                                a.each(l, function(E, F) {
                                    if (F.type != undefined && F.type == "StartBiking") {
                                        C += '<span class="icon-bike"></span><span class="descripcion">' + k + "</span>";
                                        return false
                                    }
                                });
                                if (C == "") {
                                    C += '<span class="icon-walk"></span>'
                                }
                            }
                        }
                    }
                }
            }

            function t() {
                if (f == "transporte_publico") {
                    var D = null;
                    var L = false;
                    var U = 0;
                    var O = null;
                    var M = null;
                    var F = new Array();
                    var S = new Array();
                    var G = usig.Recorrido.defaults.texts.planTransporte;
                    for (i = 0; i < e.length; i++) {
                        var Q = e[i];
                        if (Q.type != undefined) {
                            if (Q.type == "StartWalking") {
                                L = true;
                                if (i == 0) {
                                    D = G.walking["startDir"].texto.replace("$calle", e[i + 1].name);
                                    D = D.replace("$desde", e[i + 1].from)
                                } else {
                                    if (e[i - 1].calle2 != null) {
                                        D = G.walking["startCruce"].texto.replace("$calle1", e[i - 1].calle1);
                                        D = D.replace("$calle2", e[i - 1].calle2)
                                    } else {
                                        D = G.walking["startDir"].texto.replace("$calle", e[i - 1].calle1);
                                        D = D.replace("$desde", "")
                                    }
                                }
                                M = "pie"
                            } else {
                                if (Q.type == "FinishWalking") {
                                    if (D) {
                                        D += G.walking["finish"].texto;
                                        x.push({
                                            text: D,
                                            type: M,
                                            features: F
                                        });
                                        D = null;
                                        M = null;
                                        F = []
                                    }
                                    L = false
                                } else {
                                    if (Q.type == "Board") {
                                        var I = L;
                                        if (L) {
                                            if (Q.service_type == "3") {
                                                D += G.board["walking"].texto
                                            } else {
                                                D += G.board["walkingestacion"].texto.replace("$estacion", Q.stop_name)
                                            }
                                            D = D.replace("$calle1", Q.calle1);
                                            D = D.replace("$calle2", Q.calle2);
                                            if (!(D.charAt(D.length - 1) == ".")) {
                                                D += "."
                                            }
                                            x.push({
                                                text: D,
                                                type: M,
                                                features: F
                                            });
                                            L = false;
                                            D = null;
                                            M = null;
                                            F = []
                                        }
                                        if (Q.service_type == "1") {
                                            D = G.board["subte"].texto;
                                            if (U > 0) {
                                                D += G.board["estacion"].texto
                                            }
                                            M = "subte"
                                        } else {
                                            if (Q.service_type == "3") {
                                                if (Q.trip_description != "" && !Q.any_trip) {
                                                    O = G.board["ramales"].texto.replace("$ramal", Q.trip_description.replace(/\$/g, ", "))
                                                } else {
                                                    O = (!Q.any_trip) ? " (" + r.texts.hayRamales + ")" : ""
                                                }
                                                D = G.board["colectivo"].texto;
                                                if (Q.metrobus) {
                                                    D += G.board["estacion"].texto
                                                }
                                                M = "colectivo"
                                            } else {
                                                if (Q.service_type == "2") {
                                                    if (Q.trip_description != "") {
                                                        O = " (" + Q.trip_description.replace("$", " y ") + ")"
                                                    } else {
                                                        O = (!Q.any_trip) ? " (" + r.texts.hayRamales + ")" : ""
                                                    }
                                                    D = G.board["tren"].texto;
                                                    M = "tren";
                                                    if (U > 0) {
                                                        D += G.board["estacion"].texto
                                                    }
                                                }
                                            }
                                        }
                                        if (!I) {
                                            D += G.board["esquina"].texto
                                        }
                                        U += 1;
                                        D = D.replace("$calle1", Q.calle1);
                                        D = D.replace("$calle2", Q.calle2);
                                        D = D.replace("$estacion", Q.stop_name);
                                        D = D.replace("$colectivo", Q.service);
                                        D = D.replace("$tren", Q.service.toUpperCase());
                                        D = D.replace("$subte", Q.service.toUpperCase().replace("LÍNEA", ""));
                                        D = D.replace("$ramal", O);
                                        D = D.replace("$sentido", Q.trip_description)
                                    } else {
                                        if (Q.type == "Alight") {
                                            if (Q.service_type != undefined && (Q.service_type == "2" || Q.service_type == "1")) {
                                                D += G.alight["subtetren"].texto
                                            } else {
                                                if (Q.metrobus) {
                                                    D += G.alight["metrobus"].texto
                                                } else {
                                                    D += G.alight["cole"].texto
                                                }
                                            }
                                            D = D.replace("$calle1", Q.calle1);
                                            D = D.replace("$calle2", Q.calle2);
                                            D = D.replace("$estacion", Q.stop_name);
                                            if (!(D.charAt(D.length - 1) == ".")) {
                                                D += "."
                                            }
                                            x.push({
                                                text: D,
                                                type: M,
                                                features: F
                                            });
                                            D = null;
                                            M = null;
                                            F = []
                                        } else {
                                            if (Q.type == "Bus" && Q.gml) {
                                                F.push(Q.gml)
                                            } else {
                                                if (Q.type == "SubWay" && Q.gml) {
                                                    if (F.length == 0) {
                                                        F.push(Q.gml)
                                                    } else {
                                                        var P = F[F.length - 1];
                                                        if (P.search("gml:LineString") >= 0 && P.search("subway") >= 0) {
                                                            var R = Q.gml
                                                        } else {
                                                            F.push(Q.gml)
                                                        }
                                                    }
                                                } else {
                                                    if (Q.type == "SubWayConnection") {
                                                        x.push({
                                                            text: D,
                                                            type: M,
                                                            features: F
                                                        });
                                                        D = G.subwayconnection.texto;
                                                        D = D.replace("$estacionorigen", Q.stop_from);
                                                        D = D.replace("$estaciondestino", Q.stop);
                                                        D = D.replace("$subte", Q.service_to.toUpperCase().replace("LÍNEA", ""));
                                                        D = D.replace("$sentido", Q.trip_description);
                                                        M = "subte";
                                                        F = [];
                                                        F.push(R)
                                                    } else {
                                                        if (Q.type == "Street" && Q.gml) {
                                                            F.push(Q.gml)
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                } else {
                    if (f == "walk") {
                        var J = new Array();
                        var H = 0;
                        for (i = 0; i < e.length; i++) {
                            var Q = e[i];
                            if (Q.type != undefined) {
                                var K = null;
                                if (Q.type == "Street") {
                                    H++;
                                    K = Q.name + " ";
                                    if (typeof(Q.from) != "undefined") {
                                        K += Q.from
                                    }
                                    if (typeof(Q.to) != "undefined") {
                                        K += " - " + Q.to
                                    }
                                    J.push({
                                        type: "walk",
                                        text: K,
                                        distance: Q.distance,
                                        index: H,
                                        id: Q.id
                                    })
                                }
                            }
                        }
                        x = J
                    } else {
                        if (f == "car") {
                            J = new Array();
                            H = 0;
                            var K;
                            var T = usig.Recorrido.defaults.texts.planAuto;
                            for (i = 0; i < e.length; i++) {
                                var Q = e[i];
                                if (Q.type != undefined) {
                                    var N;
                                    if (Q.type == "Street") {
                                        H++;
                                        if (Q.indicacion_giro != "0" && Q.indicacion_giro != "1" && Q.indicacion_giro != "2") {
                                            K = T.irDesde.texto;
                                            N = "seguir"
                                        } else {
                                            if (Q.indicacion_giro == "0") {
                                                K = T.seguir.texto;
                                                N = "seguir"
                                            } else {
                                                if (Q.indicacion_giro == "1") {
                                                    K = T.doblarIzq.texto;
                                                    N = "izquierda"
                                                } else {
                                                    if (Q.indicacion_giro == "2") {
                                                        K = T.doblarDer.texto;
                                                        N = "derecha"
                                                    }
                                                }
                                            }
                                        }
                                        if (Q.from) {
                                            K = K.replace("$desde", Q.from)
                                        } else {
                                            K = K.replace("$desde", "")
                                        }
                                        if (Q.to) {
                                            K += T.hasta.texto.replace("$hasta", Q.to)
                                        }
                                        K = K.replace(/\$calle/g, Q.name);
                                        J.push({
                                            text: K,
                                            turn_indication: N,
                                            index: H,
                                            distance: Q.distance,
                                            type: "car",
                                            id: Q.id
                                        })
                                    }
                                }
                            }
                            x = J
                        } else {
                            if (f == "bike") {
                                var L = false;
                                J = new Array();
                                var H = 0;
                                var K;
                                var E = usig.Recorrido.defaults.texts.planBici;
                                for (i = 0; i < e.length; i++) {
                                    var Q = e[i];
                                    if (Q.type != undefined) {
                                        if (Q.type == "StartWalking") {
                                            L = true
                                        } else {
                                            if (Q.type == "FinishWalking") {
                                                L = false
                                            } else {
                                                if (Q.type == "Street") {
                                                    if (Q.indicacion_giro != "0" && Q.indicacion_giro != "1" && Q.indicacion_giro != "2") {
                                                        if (L) {
                                                            K = E.inicio["walking"].texto
                                                        } else {
                                                            K = E.inicio["biking"].texto
                                                        }
                                                        N = "seguir"
                                                    } else {
                                                        K = E[L ? "walking" : "biking"][Q.indicacion_giro].texto;
                                                        N = E[L ? "walking" : "biking"][Q.indicacion_giro].turn_indication
                                                    }
                                                    if (Q.tipo == "Ciclovía") {
                                                        K = K.replace("$via", E.ciclovia.texto)
                                                    } else {
                                                        if (Q.tipo == "Carril preferencial") {
                                                            K = K.replace("$via", E.carril.texto)
                                                        } else {
                                                            K = K.replace("$via", "")
                                                        }
                                                    }
                                                    if (Q.to == 0 || Q.from == 0 || Q.to == null || Q.from == null) {
                                                        K = K.replace("$metros", Q.distance + " m ")
                                                    } else {
                                                        K = K.replace("$metros", "")
                                                    }
                                                    if (Q.from) {
                                                        K = K.replace("$desde", Q.from)
                                                    } else {
                                                        K = K.replace("$desde", "")
                                                    }
                                                    if (Q.to) {
                                                        K += E.hasta.texto.replace("$hasta", Q.to)
                                                    }
                                                    K = K.replace(/\$calle/g, Q.name);
                                                    modo = L ? "walk" : "bike";
                                                    J.push({
                                                        text: K,
                                                        turn_indication: N,
                                                        modo: modo,
                                                        index: H,
                                                        distance: Q.distance,
                                                        type: "bike",
                                                        id: Q.id
                                                    })
                                                }
                                            }
                                        }
                                    }
                                }
                                x = J
                            }
                        }
                    }
                }
            }

            function b(D) {
                try {
                    v = D.id;
                    g = D.tiempo;
                    u = D.origen;
                    y = D.destino;
                    f = D.type;
                    l = D.summary;
                    h = D.traveled_distance;
                    B = a.extend({}, D);
                    B.options = r;
                    z();
                    p(D)
                } catch (E) {
                    usig.debug(E)
                }
            }

            function p(D, E) {
                if (!e && D.plan) {
                    e = D.plan;
                    B.plan = D.plan;
                    t()
                }
                if (typeof(E) == "function") {
                    E(x, e)
                }
            }

            function s(D) {
                return a(D).find("gml-coordinates").text().split(" ").map(function(E) {
                    return E.split(",").map(function(F) {
                        return parseFloat(F)
                    })
                })
            }

            function n(D) {
                var E = [];
                a(D).find("gml-lineStringMember").each(function(G, F) {
                    E.push(s(F))
                });
                return E
            }

            function o(D, E) {
                a.each(E, function(G, F) {
                    D.features.push({
                        type: "Feature",
                        properties: {
                            gml_id: null,
                            type: a(this).find("gml-type").text(),
                            fid: null
                        },
                        geometry: {
                            type: "MultiLineString",
                            coordinates: n(F)
                        }
                    })
                })
            }

            function A(D, E) {
                a.each(E, function(G, F) {
                    D.features.push({
                        type: "Feature",
                        properties: {
                            gml_id: null,
                            type: a(this).find("gml-type").text(),
                            fid: null
                        },
                        geometry: {
                            type: "LineString",
                            coordinates: s(F)
                        }
                    })
                })
            }

            function d(D, E) {
                if (E instanceof Array) {
                    E = E[0]
                }
                var F = a.parseXML(E.replace(/:/g, "-"));
                if (a(F).find("gml-feature:has(gml-MultiLineString)").length > 0) {
                    o(D, a(F).find("gml-feature:has(gml-MultiLineString)"))
                } else {
                    A(D, a(F).find("gml-feature:has(gml-LineString)"))
                }
            }

            function c(D, E) {
                var G = a(a.parseXML(E.replace(/:/g, "-")));
                if (G.find("gml-Point")) {
                    var F = G.find("gml-coordinates").text().split(",");
                    D.features.push({
                        type: "Feature",
                        properties: {
                            gml_id: null,
                            type: G.find("gml-type").text(),
                            fid: null
                        },
                        geometry: {
                            type: "Point",
                            coordinates: [parseFloat(F[0]), parseFloat(F[1])]
                        }
                    })
                } else {
                    usig.debug(G)
                }
            }
            this.getGeoJson = function() {
                if (this.geoJson) {
                    return this.geoJson
                }
                var D = this.getPlan();
                if (D instanceof Array) {
                    var F = {
                        type: "FeatureCollection",
                        features: []
                    };
                    for (i = 0; i < D.length; i++) {
                        var E = D[i];
                        if (E.type != undefined) {
                            if (E.type == "StartWalking" || E.type == "FinishWalking") {
                                if (i == 0) {
                                    c(F, E.gml.replace("walk", "beginwalk"))
                                } else {
                                    c(F, E.gml)
                                }
                            } else {
                                if (E.type == "Board") {
                                    if (i == 0) {
                                        c(F, E.gml.replace(/(bus|subway|train)/g, "begin$1"))
                                    } else {
                                        if (E.service_type == "1") {
                                            switch (E.service) {
                                                case "Línea A":
                                                    if (E.gml.indexOf("subwayA") < 0) {
                                                        E.gml = E.gml.replace("subway", "subwayA")
                                                    }
                                                    break;
                                                case "Línea B":
                                                    if (E.gml.indexOf("subwayB") < 0) {
                                                        E.gml = E.gml.replace("subway", "subwayB")
                                                    }
                                                    break;
                                                case "Línea C":
                                                    if (E.gml.indexOf("subwayC") < 0) {
                                                        E.gml = E.gml.replace("subway", "subwayC")
                                                    }
                                                    break;
                                                case "Línea D":
                                                    if (E.gml.indexOf("subwayD") < 0) {
                                                        E.gml = E.gml.replace("subway", "subwayD")
                                                    }
                                                    break;
                                                case "Línea E":
                                                    if (E.gml.indexOf("subwayE") < 0) {
                                                        E.gml = E.gml.replace("subway", "subwayE")
                                                    }
                                                    break;
                                                case "Línea H":
                                                    if (E.gml.indexOf("subwayH") < 0) {
                                                        E.gml = E.gml.replace("subway", "subwayH")
                                                    }
                                                    break
                                            }
                                        }
                                        c(F, E.gml)
                                    }
                                } else {
                                    if (E.type == "Bus" || E.type == "SubWay" || E.type == "Street") {
                                        d(F, E.gml)
                                    } else {
                                        if (E.type == "SubWayConnection") {
                                            switch (E.service_to) {
                                                case "Línea A":
                                                    E.gml[1] = E.gml[1].replace("connection", "subwayA");
                                                    break;
                                                case "Línea B":
                                                    E.gml[1] = E.gml[1].replace("connection", "subwayB");
                                                    break;
                                                case "Línea C":
                                                    E.gml[1] = E.gml[1].replace("connection", "subwayC");
                                                    break;
                                                case "Línea D":
                                                    E.gml[1] = E.gml[1].replace("connection", "subwayD");
                                                    break;
                                                case "Línea E":
                                                    E.gml[1] = E.gml[1].replace("connection", "subwayE");
                                                    break;
                                                case "Línea H":
                                                    E.gml[1] = E.gml[1].replace("connection", "subwayH");
                                                    break
                                            }
                                            c(F, E.gml[1]);
                                            d(F, E.gml)
                                        } else {
                                            if (E.type == "StartDriving" || E.type == "FinishDriving") {
                                                c(F, E.gml)
                                            } else {
                                                if (E.type == "StartBiking" || E.type == "FinishBiking") {
                                                    if (i == 0) {
                                                        c(F, E.gml.replace("bike", "beginbike"))
                                                    } else {
                                                        c(F, E.gml)
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    this.geoJson = F;
                    return F
                }
                return false
            };
            this.load = function(D) {
                b(D)
            };
            this.toString = function() {
                return k
            };
            this.toHtmlString = function() {
                return C
            };
            this.getTime = function() {
                return g
            };
            this.getTraveledDistance = function() {
                return h
            };
            this.getTimeString = function() {
                time = "";
                if (g > 60) {
                    hs = Math.floor(g / 60);
                    mins = g % 60;
                    time += hs + (hs > 1 ? "hs " : "h ") + mins + " '"
                } else {
                    time += g + " '"
                }
                return time
            };
            this.getDistanceString = function() {
                distance = "";
                if (h > 999) {
                    distance += ((h / 1000).toFixed(2) + " Km").replace(".", ",")
                } else {
                    distance += h + " m"
                }
                return distance
            };
            this.getPlan = function(E, D, F) {
                if (!e) {
                    usig.Recorridos.cargarPlanRecorrido(v, p.createDelegate(this, [E], 1), D, F)
                } else {
                    if (typeof(E) == "function") {
                        E(e)
                    }
                }
                return e
            };
            this.getDetalle = function(E, D, F) {
                if (!e) {
                    if (B.plan) {
                        p(B, E)
                    } else {
                        usig.Recorridos.cargarPlanRecorrido(v, p.createDelegate(this, [E], 1), D, F)
                    }
                } else {
                    if (typeof(E) == "function") {
                        E(x)
                    }
                }
            };
            this.getId = function() {
                return v
            };
            this.getTemplate = function() {
                return r.template
            };
            this.getColor = function() {
                return r.template.color
            };
            this.getTipo = function() {
                return f
            };
            this.setColor = function(D) {
                r.template.color = D
            };
            this.getCoordenadaOrigen = function() {
                return u
            };
            this.getCoordenadaDestino = function() {
                return y
            };
            this.toJson = function() {
                return B
            };
            this.isEqual = function(D) {
                return f == D.getTipo() && k == D.toString() && u == D.getCoordenadaOrigen() && y == D.getCoordenadaDestino()
            };
            this.getAlertas = function() {
                return m
            };
            this.setLanguage = function(D) {
                if (usig.Recorrido.texts[D]) {
                    usig.Recorrido.defaults.texts = usig.Recorrido.texts[D]
                }
                r = a.extend({}, usig.Recorrido.defaults, r)
            };
            this.setLanguage(r.lang || "es");
            if (w) {
                b(w)
            }
        }
    })(jQuery);
    usig.Recorrido.fromObj = function(a) {
        return new usig.Recorrido(a, a.options)
    };
    usig.Recorrido.defaults = {
        icons: {
            recorrido_pie: "//mapa.buenosaires.gob.ar/images/recorrido_pie20x20.png",
            recorrido_subte: "//mapa.buenosaires.gob.ar/images/recorrido_subte20x20.png",
            recorrido_tren: "//mapa.buenosaires.gob.ar/images/recorrido_tren20x20.png",
            recorrido_colectivo: "//mapa.buenosaires.gob.ar/images/recorrido_colectivo20x20.png",
            recorrido_auto: "//mapa.buenosaires.gob.ar/images/recorrido_auto20x20.png",
            recorrido_bici: "//servicios.usig.buenosaires.gob.ar/usig-js/dev/images/recorrido_bici20x20.png"
        },
        template: new usig.TripTemplate(1, "#8F58C7")
    };
    usig.Recorrido.texts = {}
}
usig.Recorrido.texts.es = {
    descWalk: "Recorrido a pie",
    descCar: "Recorrido en auto",
    descBike: "Recorrido en bici",
    hayRamales: "No todos los ramales conducen a destino",
    planTransporte: {
        walking: {
            startDir: {
                texto: 'Caminar desde <span class="plan-calle">$calle $desde</span>'
            },
            startCruce: {
                texto: 'Caminar desde <span class="plan-calle">$calle1 y $calle2</span>'
            },
            finish: {
                texto: " hasta destino."
            }
        },
        board: {
            walking: {
                texto: ' hasta <span class="plan-calle">$calle1 y $calle2</span>'
            },
            walkingestacion: {
                texto: ' hasta la estación <span class="plan-estacion">$estacion</span> en <span class="plan-calle">$calle1 y $calle2</span>'
            },
            subte: {
                texto: 'Tomar el <span class="transport">SUBTE LÍNEA $subte (en dirección a $sentido)</span>'
            },
            estacion: {
                texto: ' en la estación <span class="plan-estacion">$estacion</span>'
            },
            esquina: {
                texto: ' en <span class="plan-calle">$calle1 y $calle2</span>'
            },
            ramales: {
                texto: "(Ramales: $ramal)"
            },
            colectivo: {
                texto: 'Tomar el <span class="transport">COLECTIVO $colectivo $ramal</span>'
            },
            tren: {
                texto: 'Tomar el <span class="transport">TREN $tren $ramal</span>'
            }
        },
        alight: {
            subtetren: {
                texto: ' y bajar en la estación <span class="plan-estacion">$estacion</span>'
            },
            cole: {
                texto: ' y bajar en <span class="plan-calle">$calle1 y $calle2</span>'
            },
            metrobus: {
                texto: ' y bajar en la estación <span class="plan-estacion">$estacion</span> en <span class="plan-calle">$calle1 y $calle2</span>'
            }
        },
        subwayconnection: {
            texto: 'Bajarse en la estación <span class="plan-estacion">$estacionorigen</span> y combinar con el <span class="transport">SUBTE LÍNEA $subte (en dirección a $sentido)</span> en estación <span class="plan-estacion">$estaciondestino</span>'
        },
    },
    planAuto: {
        seguir: {
            texto: 'Seguir por <span class="plan-calle">$calle</span>'
        },
        doblarIzq: {
            texto: 'Doblar a la izquierda en <span class="plan-calle">$calle</span>'
        },
        doblarDer: {
            texto: 'Doblar a la derecha en <span class="plan-calle">$calle</span>'
        },
        irDesde: {
            texto: 'Ir desde <span class="plan-calle">$calle</span>'
        },
        hasta: {
            texto: ' hasta el <span class="plan-calle">$hasta</span>'
        }
    },
    planBici: {
        inicio: {
            walking: {
                texto: 'Caminar $metros desde <span class="plan-calle">$calle</span>'
            },
            biking: {
                texto: 'Pedalear $metros desde $via<span class="plan-calle">$calle</span>'
            }
        },
        walking: [{
            texto: 'Caminar $metros por <span class="plan-calle">$calle</span>',
            turn_indication: "seguir"
        }, {
            texto: 'Doblar a la izquierda en <span class="plan-calle">$calle</span> y caminar $metros',
            turn_indication: "izquierda"
        }, {
            texto: 'Doblar a la derecha en <span class="plan-calle">$calle</span> y caminar $metros',
            turn_indication: "derecha"
        }],
        biking: [{
            texto: 'Seguir $metros por $via<span class="plan-calle">$calle</span>',
            turn_indication: "seguir"
        }, {
            texto: 'Doblar a la izquierda en $via<span class="plan-calle">$calle</span> y seguir $metros',
            turn_indication: "izquierda"
        }, {
            texto: 'Doblar a la derecha en $via<span class="plan-calle">$calle</span> y seguir $metros',
            turn_indication: "derecha"
        }],
        hasta: {
            texto: ' hasta el <span class="plan-calle">$hasta</span>'
        },
        ciclovia: {
            texto: " ciclovia "
        },
        carril: {
            texto: " carril preferencial "
        }
    }
};
