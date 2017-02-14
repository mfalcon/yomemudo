from datetime import datetime
import csv
import json
from math import radians, cos, sin, asin, sqrt, pi

import requests as rq


GEOCODING_URL = "http://ws.usig.buenosaires.gob.ar/geocoder/2.2/reversegeocoding?"
GEOCOORD_URL = "http://ws.usig.buenosaires.gob.ar/rest/convertir_coordenadas?output=lonlat&"

def origenes_geo():
    origenes = {}
    with open('data/solocaba_latlon_coords.csv', 'rb') as caba_geo:
        freader = csv.reader(caba_geo, delimiter='\t')
        freader.next()
        for idx, row in enumerate(freader):
            origenes[idx] = {
                'lat': row[0],
                'lon': row[1],
                'x': row[2],
                'y': row[3]
            }
    
    return origenes


def get_latlong(x,y):
    url = GEOCOORD_URL + 'x=%s&y=%s' %(x,y)
    resp = rq.get(url)
    print url
    try:
        data = eval(resp.content)
        lon = data['resultado']['x']
        lat = data['resultado']['y']
    except:
        print x
        pass
    
    return float(lon), float(lat)


def haversine(lon1, lat1, lon2, lat2):
    """
    Calculate the great circle distance between two points 
    on the earth (specified in decimal degrees)
    """
    # convert decimal degrees to radians 
    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
    # haversine formula 
    dlon = lon2 - lon1 
    dlat = lat2 - lat1 
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a)) 
    km = 6367 * c
    return km
    

def boundingRectangle(lat, lon):
    #Earths radius, sphere
    r = 6378137
    #offsets in meters
    dn = 200
    de = 200
    
    ds = -200
    dw = -200

    #Coordinate offsets in radians
    dLat = dn/float(r)
    dLon = de/(r*cos(pi*lat/180))
    #Coordinate offsets in radians
    dLat2 = ds/float(r)
    dLon2 = dw/(r*cos(pi*lat/180))

    #OffsetPosition, decimal degrees
    lat1 = lat + dLat * 180/pi
    lon1 = lon + dLon * 180/pi
    lat2 = lat + dLat2 * 180/pi
    lon2 = lon + dLon2 * 180/pi
    
    print lat1
    print lon1
    print lat2
    print lon2

    return lat1, lon1, lat2, lon2
