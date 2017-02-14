from datetime import datetime
import json

from flask import Flask, jsonify, request
from flask import abort
from flask import make_response
from flask import render_template
from flask import redirect, url_for
from flask.ext.cors import  cross_origin
import requests as rq

import geocoding
import walkscore

GEOCODING_URL = "http://ws.usig.buenosaires.gob.ar/geocoder/2.2/reversegeocoding?"


app = Flask(__name__)
app.config['DEBUG'] = False


def get_trips(o_x, o_y, d_x, d_y, tipo_transporte):
    url = "http://recorridos.usig.buenosaires.gob.ar/2.0/consultar_recorridos?tipo={4}&gml=false&precargar=3&opciones_caminata=800&opciones_medios_colectivo=true&opciones_medios_subte=true&opciones_medios_tren=true&opciones_prioridad=avenidas&opciones_incluir_autopistas=true&opciones_cortes=true&max_results=10&origen={0}%2C{1}&destino={2}%2C{3}".format(o_x, o_y, d_x, d_y, tipo_transporte);
    resp = rq.get(url)
    tiempo_viaje = json.loads(resp.json()['planning'][0])['tiempo']

    return tiempo_viaje

    
def get_trip_time(origen_sel, data):
    tiempo_total = 0

    for destino in data:
        tipo_transporte = destino['tipo_transporte']
        #Para la funcion get_trips necesito las coordenadas
        tiempo_viaje = get_trips(origen_sel['origen']['x'], origen_sel['origen']['y'], destino['destino'][0], destino['destino'][1], destino['tipo_transporte'])
        tiempo_total += tiempo_viaje * int(destino['dias_semana']) * (2 if destino['trayecto'] == 'idavta' else 1)
    
    lat_long = (origen_sel['origen']['lat'], origen_sel['origen']['lon'])
    
    resultados = {'origen': origen_sel['origen'], 'tiempo_total': tiempo_total, 'latlong': lat_long}
    print "tiempo total: {0}, origen: {1}".format(tiempo_total, origen_sel)
    return resultados


@app.errorhandler(404)
def not_found(error):
    return make_response(jsonify( { 'error': 'Not found' } ), 404)


@app.route('/')
@cross_origin() # Send Access-Control-Allow-Headers
def home():
    return render_template('index.html')

    
@app.route('/best_improv', methods = ['POST'])
@cross_origin() # Send Access-Control-Allow-Headers
def best_improv():
    data = json.loads(request.data)
    #print data
    origenes_km = []
    destinos_latlon = {}
    #FIXME: key is not unique
    for destino in data: #paso los destinos de coordenadas a lat,lon
        key = float(destino['destino'][0])*float(destino['destino'][1])
        dlon, dlat = geocoding.get_latlong(destino['destino'][0], destino['destino'][1])
        destinos_latlon[key] = (dlon, dlat)
         
    '''
    Por cada punto posible de origen, calculo la distancia (en km) a
    vuelo de pajaro entre el origen y los destinos seleccionados por el
    usuario. Para la funcion haversine se necesitan las latlon de los 
    origenes y destinos.
    '''
    origenes = geocoding.origenes_geo()
    for origen, geo in origenes.items():
        recorrido_total = 0
        for destino in data:
            key = float(destino['destino'][0])*float(destino['destino'][1])
            dlon, dlat = destinos_latlon[key]
            tipo_transporte = destino['tipo_transporte']
            km_viaje = walkscore.walking_time(float(geo['lat']), float(geo['lon']), dlon, dlat)
            recorrido_total += km_viaje * int(destino['dias_semana']) * (2 if destino['trayecto'] == 'idavta' else 1)
            

        origenes_km.append({'origen': origen, 'recorrido_total': recorrido_total})
    
          
    '''
    Selecciono los X origenes que tienen un menor recorrido total en km 
    para ahorrar pedidos a servicios de terceros. Por cada origen 
    seleccionado, calculo el tiempo de viaje total a cada destino
    seleccionado por el usuario y los ordeno de menor a mayor.
    Por lo tanto, de cada X origenes se hacen Y pedidos al servicio
    externo, siendo Y = X * num_destinos.
    '''
    
    #TODO: paralelizar requests a servicios externos
    resultados = []
    total_origenes = 3
    for origen_sel in sorted(origenes_km, key=lambda x: x['recorrido_total'])[:total_origenes]:
        tiempo_total = 0
        for destino in data:
            tipo_transporte = destino['tipo_transporte']
            #Para la funcion get_trips necesito las coordenadas
            tiempo_viaje = get_trips(origenes[origen_sel['origen']]['x'], origenes[origen_sel['origen']]['y'], destino['destino'][0], destino['destino'][1], destino['tipo_transporte'])
            tiempo_total += tiempo_viaje * int(destino['dias_semana']) * (2 if destino['trayecto'] == 'idavta' else 1)
    
        lat_long = (origenes[origen_sel['origen']]['lat'], origenes[origen_sel['origen']]['lon'])
        lat_ne, lon_ne, lat_sw, lon_sw = geocoding.boundingRectangle(float(lat_long[1]),float(lat_long[0]))
        resultados.append({'origen': origen_sel['origen'], 'tiempo_total': tiempo_total, 'latlong': lat_long, 'latlong_ne': [lat_ne, lon_ne], 'latlong_sw': [lat_sw, lon_sw] })

    target_points = [e['latlong'] for e in sorted(resultados,key=lambda x: x['tiempo_total'])[:3]]
    return jsonify( { 'data': sorted(resultados,key=lambda x: x['tiempo_total']) } )



if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8999)
