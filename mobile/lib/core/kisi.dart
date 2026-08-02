/// Membagi daftar menjadi baris-baris berisi [perBaris] item.
///
/// Dipisahkan ke fungsi tersendiri karena perhitungan indeks kisi pernah
/// membuat seluruh beranda gagal digambar: jumlah item diubah, tetapi jumlah
/// barisnya masih ditulis tetap, sehingga sel terakhir mengakses indeks di luar
/// batas. Di mode rilis kegagalan itu hanya tampak sebagai kotak abu-abu.
List<List<T>> bagiPerBaris<T>(List<T> items, int perBaris) {
  if (perBaris < 1) {
    throw ArgumentError.value(perBaris, 'perBaris', 'harus minimal 1');
  }
  final hasil = <List<T>>[];
  for (var i = 0; i < items.length; i += perBaris) {
    final akhir = i + perBaris;
    hasil.add(items.sublist(i, akhir > items.length ? items.length : akhir));
  }
  return hasil;
}
