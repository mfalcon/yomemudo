#tomar los puntos georeferenciados y calcular cercania(en km) a cada punto de interes
import csv
import json

import requests

import geocoding

colegios_privados_caba = 'data/establecimientos-privados_caba.csv'
colegios_publicos_caba = 'data/establecimientos-publicos_caba.csv'
universidades_caba = 'data/universidades_caba.csv'

GRAPHHOPER_URL = 'http://127.0.0.1:8989/route?locale=en-US&vehicle=foot&weighting=fastest&elevation=false&layer=Omniscale'

def load_csv(csv_file_path, lat_row_idx, lon_row_idx, separator=',', data_type='str'):
    data = {}
    with open(csv_file_path, 'rb') as csvfile:
        creader = csv.reader(csvfile, delimiter=separator)
        creader.next()
        for row in creader:
            if row[lat_row_idx]:
                if row[lon_row_idx]:
                    if data_type == 'str':
                        data[(row[lat_row_idx], row[lon_row_idx])] = row
                    elif data_type == 'float':
                        data[(float(row[lat_row_idx]), float(row[lon_row_idx]))] = row

    return data


def walking_time(lon1, lat1, lon2, lat2, unit='minutes'):
    url = GRAPHHOPER_URL + '&point=%s,%s&point=%s,%s' % (lat1, lon1, lat2, lon2) 
    print url
    res = requests.get(url)
    if res.status_code == 200:
        data = res.json()
    else:
        data = None
        print "error"
    if data:
        if unit == 'minutes':
            if data['paths'][0]['time']/60.0:
                return data['paths'][0]['time']/60.0

    return 0
       

def time_bin(mins, time_interval=30):
    #receives a list and groups it by time interval in minutes
    return int(mins/time_interval)

def normalize_bin(x, max_t, min_t):

    return (x-min_t)/float(max_t-min_t)

def the_walkscore(target_points_file, tplat, tplon, tpsep, theme_points_file, thlat, thlon, thsep):
    target_points =  load_csv(target_points_file, tplat, tplon) #cuadrilla
    theme_points = load_csv(theme_points_file, thlat, thlon, thsep) #ex colegios
    
    in_points = geocoding.points_within_radius(target_points, theme_points, 0.0301)
    
    target_points_data = []
    for tp, points in in_points.items():
        nearest_places = sorted(points, key=lambda x: x['haversine'])[:5]
        tp_time = 0
        for np in nearest_places:
            wtime = walking_time(tp[1], tp[0], np['points'][1], np['points'][0])
            tp_time += wtime
        
        target_points_data.append([tp, tp_time, len(points), time_bin(tp_time)])
            
    
    heatmap_data = []
    max_time = max([e[3] for e in target_points_data if e[3] > 0])
    min_time = min([e[3] for e in target_points_data if e[3] > 0]) 

    for tpd in target_points_data:
        heatmap_data.append([float(tpd[0][0]), float(tpd[0][1]), normalize_bin(tpd[3], max_time, min_time)])
    

    return heatmap_data


if __name__ == '__main__':
    the_walkscore('data/puntos_cuadricula_caba.csv', 4,3, ',',colegios_publicos_caba, 24, 23, ';')
