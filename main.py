import flet as ft
import pandas as pd
import time

# Google E-Tablo'nun dışa aktarılabilir Excel formatındaki linki
GOOGLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/1m9pIg0waSup8ZT_iKIttms_WbDY7DSXT6edabDgezxw/export?format=xlsx"

# --- HIZLANDIRMA ADIMI ---
try:
    df_tum_liste = pd.read_excel(GOOGLE_SHEET_URL, sheet_name="TÜM LİSTE")
    df_tum_liste = df_tum_liste.fillna("").astype(str)
except Exception as e:
    print(f"Veri çekme hatası: {e}")
    df_tum_liste = pd.DataFrame()


def main(page: ft.Page):
    page.title = "Roxxlen Depo"
    page.window_width = 400
    page.window_height = 800
    page.theme_mode = "light"
    
    # 1. AŞAMA: SPLASH EKRANI
    page.horizontal_alignment = "center"
    page.vertical_alignment = "center"

    splash_text = ft.Text("ROXXLEN DEPO", size=40, weight="bold", color="blue")
    page.add(splash_text)
    page.update()

    time.sleep(2)

    # 2. AŞAMA: ÜRÜN BULMA EKRANI
    page.clean() 
    page.vertical_alignment = "start" 

    header = ft.Text("Ürün & Reyon Bul", size=26, weight="bold", color="black87")
    
    sonuc_alani = ft.Column(
        controls=[ft.Text("Arama sonuçları veya okunan barkod burada görünecek...", color="grey")],
        alignment="start",
        horizontal_alignment="center",
        expand=True,
        scroll=ft.ScrollMode.AUTO
    )

    # --- 3. AŞAMA: ARAMA MOTORU ---
    def arama_yap(e):
        aranan = search_input.value.strip().lower()
        sonuc_alani.controls.clear()

        if not aranan:
            sonuc_alani.controls.append(ft.Text("Lütfen aramak için bir ürün adı veya barkod girin.", color="red"))
            page.update()
            return

        try:
            if df_tum_liste.empty:
                sonuc_alani.controls.append(ft.Text("Tablo yüklenemedi. İnternet bağlantınızı kontrol edip uygulamayı yeniden başlatın.", color="red"))
            else:
                mask = df_tum_liste.apply(lambda x: x.str.lower().str.contains(aranan)).any(axis=1)
                bulunanlar = df_tum_liste[mask]

                if bulunanlar.empty:
                    sonuc_alani.controls.append(ft.Text(f"❌ '{aranan}' koduna/isme ait ürün bulunamadı.", color="red", size=16))
                else:
                    for index, row in bulunanlar.iterrows():
                        urun_adi = row.get("ÜRÜN ADI", "-")
                        urun_kodu = row.get("ÜRÜN KODU", "-")
                        raf_konumu = row.get("RAF NO", "Belirtilmemiş")
                        gorsel_url = str(row.get("GÖRSEL LİNKİ", "")).strip()

                        icerik_sutunu = ft.Column([
                            ft.Text(f"{urun_adi}", weight="bold", size=17, color="black87"),
                            ft.Text(f"Kod: {urun_kodu}", size=14, color="grey700"),
                            ft.Container(
                                content=ft.Text(f"📍 RAF / REYON NO: {raf_konumu}", size=18, weight="bold", color="white"),
                                bgcolor="blue700",
                                padding=ft.padding.all(8),
                                border_radius=8,
                                margin=ft.margin.only(top=5)
                            )
                        ], expand=True)

                        if gorsel_url.startswith("http"):
                            gorsel_kutusu = ft.Image(src=gorsel_url, width=90, height=90, fit="contain")
                            kart_icerigi = ft.Row([gorsel_kutusu, icerik_sutunu], alignment="start", vertical_alignment="center")
                        else:
                            kart_icerigi = ft.Row([icerik_sutunu], alignment="start")

                        kart = ft.Card(
                            content=ft.Container(
                                content=kart_icerigi,
                                padding=15,
                                bgcolor="white",
                                border_radius=12,
                            ),
                            elevation=4,
                            margin=8 
                        )
                        sonuc_alani.controls.append(kart)

        except Exception as ex:
            sonuc_alani.controls.append(ft.Text(f"Arama sırasında hata: {ex}", color="red"))
        
        page.update()

    # --- 4. AŞAMA: KAMERA İLE BARKOD OKUMA ---
    def kamera_ile_okut(e):
        try:
            import cv2
            
            cap = None
            for cam_index in [0, 1, 2, -1]:
                try:
                    temp_cap = cv2.VideoCapture(cam_index)
                    if temp_cap.isOpened():
                        cap = temp_cap
                        break
                except:
                    continue

            if cap is None or not cap.isOpened():
                sonuc_alani.controls.clear()
                sonuc_alani.controls.append(ft.Text("❌ Kamera açılamadı! Lütfen Ayarlar -> Uygulamalar kısmından kamera iznini onaylayın.", color="red", size=14))
                page.update()
                return

            sonuc_alani.controls.clear()
            sonuc_alani.controls.append(ft.Text("📷 Kamera aktif! Barkodu okutun...", color="blue", size=15, weight="bold"))
            page.update()

            qr_detector = cv2.QRCodeDetector()
            scanned_code = None
            start_time = time.time()

            while time.time() - start_time < 25:
                ret, frame = cap.read()
                if not ret:
                    break

                val, pts, _ = qr_detector.detectAndDecode(frame)
                if val:
                    scanned_code = val
                    break

                if hasattr(cv2, 'barcode'):
                    try:
                        barcode_detector = cv2.barcode.BarcodeDetector()
                        retval, decoded_info, _, _ = barcode_detector.detectAndDecode(frame)
                        if retval and decoded_info and len(decoded_info) > 0 and decoded_info[0]:
                            scanned_code = decoded_info[0]
                            break
                    except:
                        pass

                cv2.imshow("Roxxlen Depo - Barkod Okuyucu", frame)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break

            cap.release()
            cv2.destroyAllWindows()

            if scanned_code:
                search_input.value = str(scanned_code).strip()
                arama_yap(None)
            else:
                sonuc_alani.controls.clear()
                sonuc_alani.controls.append(ft.Text("⚠️ Barkod okunamadı veya tarama iptal edildi.", color="orange", size=14))
                page.update()

        except Exception as ex:
            sonuc_alani.controls.clear()
            sonuc_alani.controls.append(ft.Text(f"❌ Kamera Hatası: {ex}", color="red"))
            page.update()

    # --- 5. AŞAMA: KONTROLLER (STRING İKONLAR İLE HATA ÇÖZÜLDÜ) ---
    search_input = ft.TextField(
        label="Ürün adı, barkod veya ana kod girin",
        prefix_icon="search",
        suffix=ft.IconButton(
            icon="camera_alt",
            icon_color="blue",
            tooltip="Kamera ile Barkod Okut",
            on_click=kamera_ile_okut
        ),
        border_radius=15,
        expand=True,
        text_size=16,
        on_submit=arama_yap
    )
    
    search_button = ft.ElevatedButton("Ara", on_click=arama_yap, icon="search")
    camera_button = ft.ElevatedButton("📷 Barkod Tara", on_click=kamera_ile_okut, icon="camera_alt", bgcolor="blue", color="white")

    page.add(
        ft.Container(height=20), 
        ft.Row([header], alignment="center"),
        ft.Container(height=15),
        ft.Row([search_input], alignment="center"),
        ft.Row([search_button, camera_button], alignment="center", spacing=15),
        ft.Container(height=15),
        sonuc_alani
    )

ft.app(target=main)
