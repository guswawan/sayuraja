# Sayuraja Database Setup Guide (Google Sheets)

To set up the database for the Sayuraja AI Concierge, follow these steps:

## 1. Create a New Google Sheet
1. Create a new Google Sheet named `Sayuraja_Database`.
2. Note the **Spreadsheet ID** from the URL: `https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID/edit`.

## 2. Set Up Sheet 1: `Product_Catalog`
1. Rename the first tab to `Product_Catalog`.
2. Import `Product_Catalog.csv` or copy the headers:
   `Product_ID`, `Product_Name`, `Category`, `Price_Number`, `Unit`, `Stock_Status`, `Search_Alias`, `RAG_Context`
3. In cell **H2** (`RAG_Context`), paste this formula. 

   **Option A: Standard Formula** (Try this first):
   ```excel
   =IF(B2="","", "Product " & B2 & " (" & G2 & ") belongs to the " & C2 & " category. The current price is Rp " & D2 & " per " & E2 & ". Current stock status: " & F2 & ".")
   ```

   **Option B: If you get #ERROR! (Indonesian/Regional Locale)**:
   If your Google Sheets uses commas as decimals (common in Indonesia), you must use **semicolons (`;`)** instead of commas:
   ```excel
   =IF(B2=""; ""; "Product " & B2 & " (" & G2 & ") belongs to the " & C2 & " category. The current price is Rp " & D2 & " per " & E2 & ". Current stock status: " & F2 & ".")
   ```

   **Option C: Auto-apply to all rows (Recommended)**:
   Clear all of column H and paste this in **H2** only:
   ```excel
   =ARRAYFORMULA(IF(B2:B=""; ""; "Product " & B2:B & " (" & G2:G & ") belongs to the " & C2:C & " category. The current price is Rp " & D2:D & " per " & E2:E & ". Current stock status: " & F2:F & "."))
   ```


## 3. Set Up Sheet 2: `Operational_Knowledge_Base`
1. Create a new tab and rename it to `Operational_Knowledge_Base`.
2. Import `Operational_Knowledge_Base.csv` or copy the headers:
   `Context_Info`, `Rule_Description`

## 4. API Configuration
1. Ensure the sheet is **Shared** (View access) if using a simple API Key, or shared with your Service Account email.
2. Update your `wrangler.toml` or `.env` in the backend with the `GOOGLE_SHEET_ID`.
