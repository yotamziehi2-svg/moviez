#!/usr/bin/env bash
PORT=3000
echo "Démarrage de MovieZ sur http://localhost:$PORT ..."
python3 -m http.server $PORT
