import flet as ft
import pandas as pd
import time

# Google E-Tablo'nun dışa aktarılabilir Excel formatındaki linki
GOOGLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/1m9pIg0waSup8ZT_iKIttms_WbDY7DSXT6edabDgezxw/export?format=xlsx"

# --- HIZLANDIRMA ADIMI ---
# Uygulama açılırken veriyi BİR KERE internetten çekip hafızaya alıyoruz.
# Böylece her aramada indirme beklemiyoruz.
try:
    df_tum_liste = pd.read_excel(GOOGLE_SHEET_URL, sheet_name="TÜM LİSTE")
    df_tum_liste = df_tum_liste.fillna("").astype(str)
except Exception as e:
    print(f"Veri çekme hatası: {e}")
    df_tum_liste = pd.DataFrame()


def main(page: ft.Page):
    # Uygulama penceresi ayarları
    page.title = "Roxxlen Depo"
    page.window_width = 400
    page.window_height = 800
    page.theme_mode = "light"
    
    # 1. AŞAMA: SPLASH (AÇILIŞ) EKRANI
    page.horizontal_alignment = "center"
    page.vertical_alignment = "center"

    splash_text = ft.Text("ROXXLEN", size=45, weight="bold", color="blue")
    page.add(splash_text)
    page.update()

    time.sleep(2)

    # 2. AŞAMA: ÜRÜN BULMA EKRANINA GEÇİŞ
    page.clean() 
    page.vertical_alignment = "start" 

    header = ft.Text("Ürün Bul", size=28, weight="bold", color="black")
    
    sonuc_alani = ft.Column(
        controls=[ft.Text("Arama sonuçları burada görünecek...", color="grey")],
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
            sonuc_alani.controls.append(ft.Text("Lütfen aramak için bir değer girin.", color="red"))
            page.update()
            return

        try:
            # Veriyi internetten tekrar indirmek yerine doğrudan hafızadaki tablodan (df_tum_liste) anında okuyoruz
            if df_tum_liste.empty:
                sonuc_alani.controls.append(ft.Text("Tablo yüklenemedi. İnternet bağlantınızı kontrol edip uygulamayı yeniden başlatın.", color="red"))
            else:
                # Girilen kelimeyi hafızadaki tablonun tüm satır ve sütunlarında ara
                mask = df_tum_liste.apply(lambda x: x.str.lower().str.contains(aranan)).any(axis=1)
                bulunanlar = df_tum_liste[mask]

                if bulunanlar.empty:
                    sonuc_alani.controls.append(ft.Text("Bu koda/isme ait ürün bulunamadı.", color="red"))
                else:
                    for index, row in bulunanlar.iterrows():
                        
                        urun_adi = row.get("ÜRÜN ADI", "-")
                        urun_kodu = row.get("ÜRÜN KODU", "-")
                        raf_konumu = row.get("RAF NO", "Belirtilmemiş")

                        kart = ft.Card(
                            content=ft.Container(
                                content=ft.Column([
                                    ft.Text(f"{urun_adi}", weight="bold", size=18, color="black87"),
                                    ft.Text(f"Kod: {urun_kodu}", size=14, color="grey700"),
                                    ft.Text(f"Konum: {raf_konumu}", size=16, weight="bold", color="blue700"),
                                ]),
                                padding=15,
                                bgcolor="white",
                                border_radius=10,
                            ),
                            elevation=3,
                            margin=10  # Hata veren margin kodu düzeltildi
                        )
                        sonuc_alani.controls.append(kart)

        except Exception as ex:
            sonuc_alani.controls.append(ft.Text(f"Arama sırasında hata: {ex}", color="red"))
        
        page.update()

    search_input = ft.TextField(
        label="Ürün adı, barkod veya ana kod girin",
        prefix_icon="search", 
        suffix_icon="qr_code_scanner", 
        border_radius=15,
        expand=True,
        text_size=16,
        on_submit=arama_yap
    )
    
    search_button = ft.ElevatedButton("Ara", on_click=arama_yap, icon="search")

    page.add(
        ft.Container(height=30), 
        ft.Row([header], alignment="center"),
        ft.Container(height=20),
        ft.Row([search_input], alignment="center"),
        ft.Row([search_button], alignment="center"),
        ft.Container(height=20),
        sonuc_alani
    )

ft.app(target=main)