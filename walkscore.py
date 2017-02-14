#tomar los puntos georeferenciados y calcular cercania(en km) a cada punto de interes
import csv
import json

import requests


GRAPHHOPER_URL = 'http://127.0.0.1:8989/route?locale=en-US&vehicle=foot&weighting=fastest&elevation=false&layer=Omniscale'

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
