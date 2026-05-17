module.exports = {
  "engine": [
    {
      "id": "engine-1",
      "name": "Viz Engine 1",
      "host": "127.0.0.1",
      "port": 6100,
      "enabled": true
    },
    {
      "id": "engine-2",
      "name": "Viz Engine 2",
      "host": "127.0.0.1",
      "port": 6100,
      "enabled": false
    }
  ],
  "pilot": {
    "host": "127.0.0.1",
    "port": 8177
  },
  "mse": {
    "host": "127.0.0.1",
    "port": 8580
  },
  "hub": {
    "host": "127.0.0.1",
    "port": 19398,
    "username": "Admin",
    "password": "VizDb"
  },
  "previewServer": {
    "host": "127.0.0.1",
    "port": 21098
  }
};
