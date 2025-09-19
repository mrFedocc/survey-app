import { google } from "googleapis";
import * as fs from "fs";

export class GoogleSheetsService {
  private auth;
  private sheets;

  constructor() {
    this.auth = new google.auth.GoogleAuth({
      keyFile: "/opt/app/keys/petly-google.json", // твой ключ
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    this.sheets = google.sheets({ version: "v4", auth: this.auth });
  }

  // запись одной строки (поответно)
  async appendRow(spreadsheetId: string, values: any[]) {
    await this.sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "A:Z",
      valueInputOption: "RAW",
      requestBody: { values: [values] },
    });
  }

  // полная замена таблицы (wide-режим)
  async updateTable(spreadsheetId: string, values: any[][]) {
    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "A:Z",
      valueInputOption: "RAW",
      requestBody: { values },
    });
  }
}
