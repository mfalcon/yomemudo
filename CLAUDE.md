# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

YoMeMudo is a web application for Buenos Aires that finds optimal neighborhoods to move to based on minimizing total commute time to the user's frequent destinations. Users enter destinations, frequency, and transport type; the app calculates the top 3 geographic zones with the shortest aggregate travel time and displays them on a Leaflet map.

The project is written in Python 2 and uses the Flask framework.

## Prerequisites

- **GraphHopper** instance running locally for walking-time routing calculations. Install from [graphhopper quickstart](https://github.com/graphhopper/graphhopper/blob/master/docs/web/quickstart.md), then run: `./graphhopper.sh web argentina-latest.osm`
- A CSV data file at `data/solocaba_latlon_coords.csv` (tab-delimited, columns: lat, lon, x, y) containing candidate origin points across Buenos Aires (CABA)

## Commands

```bash
# Install dependencies
pip install -r requirements.txt

# Run development server (port 8999)
python api.py
```

Production deployment uses mod_wsgi via Apache (`yomemudo.conf`, `ymmapp.wsgi`).

## Architecture

### Backend (Python 2 / Flask)

- **`api.py`** - Flask app with two routes:
  - `GET /` - serves the single-page frontend
  - `POST /best_improv` - main algorithm endpoint. Receives a JSON array of destinations (coordinates, days/week, trip direction, transport type). First narrows candidates using haversine distance (via `walkscore.walking_time` using GraphHopper), then queries the Buenos Aires transit routing API (`recorridos.usig.buenosaires.gob.ar`) for the top 3 closest origins to get exact travel times.

- **`geocoding.py`** - Coordinate utilities:
  - `origenes_geo()` - loads all candidate origin points from `data/solocaba_latlon_coords.csv`
  - `get_latlong()` - converts Buenos Aires coordinate system (x,y) to lat/lon via the USIG API
  - `haversine()` - great-circle distance between two points
  - `boundingRectangle()` - computes a 200m bounding box around a point (used for property search links)

- **`walkscore.py`** - Queries the local GraphHopper instance (`localhost:8989`) for walking time between two points. Used as a fast pre-filter before calling the slower external transit API.

### Frontend (jQuery / Leaflet)

- **`templates/index.html`** - Single-page UI with Bootstrap. Users add up to 4 destinations with autocomplete (Buenos Aires addresses via USIG), select days/week, trip direction (one-way/round-trip), and transport type (public/car).

- **`static/js/recorrido_publico_v3.js`** - Main frontend logic. Initializes the Leaflet map centered on Buenos Aires, handles form cloning for multiple destinations, POSTs to `/best_improv`, and renders results as colored circles on the map with links to property search sites.

- **`static/js/autocompleter.js`** - USIG address autocomplete widget (bundled third-party library)
- **`static/js/recorridos.js`** - USIG transit routing client library (bundled third-party)

### External Services

- **USIG Buenos Aires APIs** - geocoding, coordinate conversion, transit route planning
- **GraphHopper** (local) - walking time/distance calculations
- **MapQuest tiles** - map rendering via Leaflet

## Key Notes

- The algorithm uses a two-phase approach: (1) haversine distance pre-filter to select top 3 candidate origins, (2) actual transit routing API calls only for those 3. This reduces external API calls from O(origins * destinations) to O(3 * destinations).
- Coordinates use the Buenos Aires-specific USIG system (x, y) which differs from standard lat/lon. Conversion happens via `geocoding.get_latlong()`.
