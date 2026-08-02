/// Base URL of the Sembung Explorer API.
///
/// 10.0.2.2 is how the Android emulator reaches the host machine; override with
/// `--dart-define=API_URL=https://api.sembung.id` for a real deployment.
const String kApiUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: 'http://10.0.2.2:5022',
);

/// Coordinates of the Pasanggrahan basecamp — the map's default focus.
const double kBasecampLat = -6.5312;
const double kBasecampLng = 107.3585;

const String kParkName = 'Kawasan Wisata Gunung Sembung';
const String kSarPhone = '115';
