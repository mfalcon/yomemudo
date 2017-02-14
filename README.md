# yomemudo
Aplicación que permite encontrar las zonas geográficas que tienen menor tiempo de transporte de acuerdo a los lugares que frecuenta el usuario.

Para correr la aplicación se debe instalar una instancia de [graphhoper](https://github.com/graphhopper/graphhopper), este link te servirá para instalarlo [quickstart](https://github.com/graphhopper/graphhopper/blob/master/docs/web/quickstart.md). 

Una vez instalado graphhoper, podés correrlo con este comando (ejemplo para Argentina):
```
./graphhopper.sh web argentina-latest.osm
```
Instalá las dependencias de python:
```
pip install -r requirements.txt
```
Corré el server de prueba de Flask:
```
python api.py
```
