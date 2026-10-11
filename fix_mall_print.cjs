const fs = require("fs");
let content = fs.readFileSync("src/routes/admin/mall.tsx", "utf8");

// Fix Excel export
const oldCsvCode = `let csvContent = "data:text/csv;charset=utf-8,\\uFEFF";`;
const newCsvCode = `let csvContent = "\\uFEFF";`;
content = content.replace(oldCsvCode, newCsvCode);

// Fix Print Button
const oldPrintCode = `                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.print()}
                        className="rounded-xl text-xs font-bold gap-1 cursor-pointer h-8"
                      >
                        <Printer size={14} />
                        طباعة المستند
                      </Button>`;

const newPrintCode = `                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const parkTxs = state.parkTicketTransactions || [];
                          const html = \`
                            <!DOCTYPE html>
                            <html dir="rtl" lang="ar">
                            <head>
                              <meta charset="utf-8">
                              <title>تقرير مبيعات تذاكر الحديقة</title>
                              <style>
                                @page { size: A4 landscape; margin: 15mm; }
                                body { font-family: 'Tajawal', sans-serif; font-size: 11px; }
                                table { width: 100%; border-collapse: collapse; margin-top: 15px; text-align: right; }
                                th, td { border: 1px solid #ccc; padding: 6px; }
                                th { background: #f3f4f6; font-weight: bold; }
                                .header { text-align: center; margin-bottom: 20px; }
                                .header h2 { font-size: 18px; margin: 0 0 5px 0; }
                              </style>
                            </head>
                            <body>
                              <div class="header">
                                <h2>تقرير مبيعات تذاكر الحديقة الشامل</h2>
                                <p>تاريخ الطباعة: \${new Date().toLocaleString('ar-EG')}</p>
                              </div>
                              <table>
                                <thead>
                                  <tr>
                                    <th>رقم الفاتورة</th>
                                    <th>الكاشير</th>
                                    <th>التاريخ والوقت</th>
                                    <th>العملة</th>
                                    <th>المبلغ بالعملة</th>
                                    <th>المعادل ($)</th>
                                    <th>طريقة الدفع</th>
                                    <th>رقم القيد</th>
                                    <th>الحالة</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  \${parkTxs.map(t => \`
                                    <tr>
                                      <td>\${t.tx_number}</td>
                                      <td>\${t.created_by || "-"}</td>
                                      <td>\${t.transaction_date} \${t.transaction_time}</td>
                                      <td>\${t.currency}</td>
                                      <td>\${t.total_paid_in_currency}</td>
                                      <td>$\${t.total_usd}</td>
                                      <td>\${t.payment_method}</td>
                                      <td>\${t.journal_entry_ref || "-"}</td>
                                      <td>\${t.status === "refunded" ? "مرتجع" : "مكتملة"}</td>
                                    </tr>
                                  \`).join('')}
                                </tbody>
                              </table>
                            </body>
                            </html>
                          \`;
                          
                          import('@/shared/utils/printAccountingDocument').then(({ printRawHtml }) => {
                            printRawHtml(html);
                          });
                        }}
                        className="rounded-xl text-xs font-bold gap-1 cursor-pointer h-8"
                      >
                        <Printer size={14} />
                        طباعة المستند
                      </Button>`;

content = content.replace(oldPrintCode, newPrintCode);

fs.writeFileSync("src/routes/admin/mall.tsx", content);
console.log("Success mall");
