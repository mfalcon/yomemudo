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
        /*
		var ac = new usig.AutoCompleter('d1', {
       		debug: false,
       		rootUrl: '../',
       		onReady: function() {
       			$('#d').val('').removeAttr('disabled');	        			
       		},
       		afterSelection: function(option) {
       			if (option instanceof usig.Direccion || option instanceof usig.inventario.Objeto) {
       				destino = option;
       			}
       		},
       		afterGeoCoding: function(pt) {
    			if (pt instanceof usig.Punto) {
    				if (destino instanceof usig.Direccion) {
    					destino.setCoordenadas(pt);
    				}				
    			}		       			
       		} 
       	});
        */

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
            clon.children('input').prop('id', 'd'+num);
            clon.children('input').val('');
            clon.children('select')[0].id= 'dds'+num;
            clon.children('select')[1].id= 'sd'+num;
            clon.children('select')[2].id = 'ttrans'+num;
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
                    dest['dias_semana'] = div_selector.children('.dds').val()
                    dest['trayecto'] = div_selector.children('.sd').val()
                    dest['tipo_transporte'] = div_selector.children('.ttrans').val()
                    req_data.push(dest);
                }
            }
            
            
            url = 'http://127.0.0.1:8989/best';
            $(document).ajaxStart(function(){
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
                    $.each(top3, function(i)
                    {
                        alternativas += "Barrio: " + top3[i]["origen"] + ", minutos por semana: "+ top3[i]["tiempo_total"] + '\n';
                    });
                     
                    alert('Estas son las mejores 3 alternativas: \n' + alternativas);
                },
                error: function() { 'failed'; }
            });

		});
	});	
