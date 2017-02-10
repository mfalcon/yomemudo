    $.noConflict();
    jQuery(document).ready(function($) {
        //var destino, recorridos;
        var optsRecorridos = {
                tipo: 'transporte',
                gml: false
            };
        usig.Recorridos.init(optsRecorridos);
        
        var destinos = Array.apply(null, Array(5)).map(function () {});
        
        function create_ac(id_tag, idx) {
            var ac = new usig.AutoCompleter(id_tag, {
                debug: false,
                rootUrl: '../',
                onReady: function() {
                    $('#d').val('').removeAttr('disabled');                     
                },
                afterSelection: function(option) {
                    if (option instanceof usig.Direccion || option instanceof usig.inventario.Objeto) {
                        //dest = option;
                        destinos[idx] = option;
                    }
                },
                afterGeoCoding: function(pt) {
                    if (pt instanceof usig.Punto) {
                        if (destinos[idx] instanceof usig.Direccion) {
                            destinos[idx].setCoordenadas(pt);
                        }               
                    }                       
                } 
            });
        }
       
        create_ac('d1', 1 - 1);

        
        var mymap = L.map('mapid');
        mymap.setView([-34.6169156,-58.447297], 12);
        L.tileLayer( 'http://{s}.mqcdn.com/tiles/1.0.0/map/{z}/{x}/{y}.png', {
                        attribution: '&copy; <a href="http://osm.org/copyright" title="OpenStreetMap" target="_blank">OpenStreetMap</a> contributors | Tiles Courtesy of <a href="http://www.mapquest.com/" title="MapQuest" target="_blank">MapQuest</a> <img src="http://developer.mapquest.com/content/osm/mq_logo.png" width="16" height="16">',
                        subdomains: ['otile1','otile2','otile3','otile4']
        }).addTo( mymap );
        
        var mapLayer = MQ.mapLayer().addTo(mymap);
        


        $('#mainForm').bind("submit", function () {
            return false;
        }); 
        
        $('#agregar').click(function(ev){
            ev.preventDefault();
    
            var $div = $('div[id^="destino"]:last');
            var num = parseInt( $div.prop("id").match(/\d+/g), 10 ) +1;
            if (num == 5) {
                $('#agregar').hide();
            }
            var clon = $div.clone().prop('id', 'destino'+num );
            clon.find('input').prop('id', 'd'+num);
            clon.find('input').val('');
            clon.find('select')[0].id= 'dds'+num;
            clon.find('select')[1].id= 'sd'+num;
            clon.find('select')[2].id = 'ttrans'+num;
            clon.appendTo( ".destinos" );

            var dest = create_ac('d'+num, num-1);
        });

        
        $('#buscar').click(function(ev) {
            ev.preventDefault();
            
            var req_data = [];
            var elements = $('div[class="destinos"]').children();
            for (var el in elements){
                if (typeof(destinos[el]) === 'object'){
                    var dest = {};
                    dest['destino'] = [destinos[el].getCoordenadas().x, destinos[el].getCoordenadas().y];
                    var div_selector = $('#'+elements[el].getAttribute('id'))
                    dest['dias_semana'] = div_selector.find('.dds').val()
                    dest['trayecto'] = div_selector.find('.sd').val()
                    dest['tipo_transporte'] = div_selector.find('.ttrans').val()
                    req_data.push(dest);
                }
            }
            
            
            url = '/best_improv';
            $(document).ajaxStart(function(){
                $("body").scrollTop(0);
                $('.loading-overlay').show();
                $('#buscar').hide();
            });
            $(document).ajaxComplete(function(){
                $('.loading-overlay').hide();
                $('#buscar').show();
            });
            $.ajax({
                url: url,
                data: JSON.stringify(req_data),
                type: 'POST',
                contentType: 'application/json;charset=UTF-8',
                success: function(data) {
                    var alternativas = '';
                    var top3 = data.data.slice(0,3);
                    var colors = ['#1EBE39','#55C768','#80CA8C'];
                    $.each(top3, function(i, item)
                    {
                        alternativa = "<b>" + item["tiempo_total"] + "</b>" + " minutos por semana.";
                        //FIXME: remove previous pinnings to map
                        
                        
                        var circle = L.circle([item['latlong'][1],item['latlong'][0]], 800, {
                            color: colors[i],
                            fillColor: '#f03',
                            fillOpacity: 0.3
                        }).addTo(mymap);
                        
                        var ri = "<a target='_blank' href=" + "http://buscador.reporteinmobiliario.com/s/Capital-Federal--Argentina?operacion%5B%5D=Venta&operacion%5B%5D=Alquiler&sw_lat=" + item['latlong_sw'][0] + "&sw_lng=" + item['latlong_sw'][1] + "&ne_lat=" + item['latlong_ne'][0] + "&ne_lng=" + item['latlong_ne'][1] + "&zoom=15&search_by_map=true" +">Ver propiedades en Reporte Inmobiliario</a>"
                        var ml = "<a target='_blank' href=" + "http://inmuebles.mercadolibre.com.ar/departamentos/_DisplayType_M#D[lat:" + item['latlong'][1] + ",long:" + item['latlong'][0] + ",zoom:15,qstring:9991459-AMLA_1459_1=9991459-AMLA_1459_1-MMLA12617&9991459-AMLA_1459_2=9991459-AMLA_1459_2-MMLA12623&]" +">Ver propiedades en Mercado Libre</a>"
                        circle.bindPopup("Viviendo en esta zona viajarías" + " " + alternativa + "<br />" + ri + "<br />" + ml);
                        
                        
                        //var marker = L.marker([item['latlong'][1],item['latlong'][0]]).addTo(mymap);
                        
                        /* marcadores de propiedades
                        $.each(item['inside_points'], function(j, dpoint)
                        {
                            

                            var marker = L.marker([dpoint[7],dpoint[8]]).addTo(mymap);
                            var popup = '<h3>Precio: ' + dpoint[9] + ' ' + dpoint[10] + ' </h3>' + '<h4>'+ dpoint[22] + '</h4>'+ '<img src="' + dpoint[23] + '">';
                            marker.bindPopup(popup);

                        });
                        */
                        
                        /*
                        $.each(item['school_points'], function(k, dpoint)
                        {
                            

                            var marker = L.marker([dpoint[24],dpoint[23]]).addTo(mymap);
                            var popup = '<h3>Colegio: ' + dpoint[6] + ' </h3><p>' + dpoint[13] + '</p>';
                            marker.bindPopup(popup);

                        });
                        */
                        
                    });

                    //$('#modal-results').modal('show');
                },
                error: function() { 'failed'; }
            });

        });
        
        
        /*
        //experimental
        var mymap2 = L.map('mapid');
        mymap2.setView([-34.6169156,-58.447297], 12);
        L.tileLayer( 'http://{s}.mqcdn.com/tiles/1.0.0/map/{z}/{x}/{y}.png', {
                        attribution: '&copy; <a href="http://osm.org/copyright" title="OpenStreetMap" target="_blank">OpenStreetMap</a> contributors | Tiles Courtesy of <a href="http://www.mapquest.com/" title="MapQuest" target="_blank">MapQuest</a> <img src="http://developer.mapquest.com/content/osm/mq_logo.png" width="16" height="16">',
                        subdomains: ['otile1','otile2','otile3','otile4']
        }).addTo( mymap2 );

        url = 'http://127.0.0.1:8999/walkscore';
       
        $.ajax({
            url: url,
            //data: JSON.stringify(req_data),
            type: 'GET',
            //contentType: 'application/json;charset=UTF-8',
            success: function(data) {
                var heatmap_data = [];
                $.each(data['data'], function(i, item)
                {
                    heatmap_data.push(item);
                }); 
                var heat = L.heatLayer(heatmap_data, {radius: 25}).addTo(mymap2);
            },
            error: function() { 'failed'; }


        });
        */

    }); 
