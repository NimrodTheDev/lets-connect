import { WebView } from "react-native-webview";
import { StyleSheet, View } from "react-native";

export default function MapScreen() {
    const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        />

        <style>
          html, body, #map {
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
          }
        </style>
      </head>

      <body>
        <div id="map"></div>

        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

        <script>
          const map = L.map('map').setView([6.5244, 3.3792], 13);

          L.tileLayer(
            'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            {
              attribution: '&copy; OpenStreetMap contributors',
              maxZoom: 19
            }
          ).addTo(map);

          L.marker([6.5244, 3.3792])
            .addTo(map)
            .bindPopup('Lagos');
        </script>
      </body>
    </html>
  `;

    return (
        <View style={styles.container}>
            <WebView
                source={{ html }}
                style={styles.webview}
                javaScriptEnabled
                domStorageEnabled
                originWhitelist={["*"]}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        height: 280,
        width: "100%",
        overflow: "hidden",
        borderRadius: 24,
    },
    webview: {
        flex: 1,
        backgroundColor: "transparent",
    },
});