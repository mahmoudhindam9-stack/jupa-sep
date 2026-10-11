const fs = require("fs");
let content = fs.readFileSync("src/routes/admin/mall.tsx", "utf8");

const oldButton = `<Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setIsParkShiftCloseModalOpen(true)}
                    className="rounded-xl text-xs font-bold gap-1.5 cursor-pointer"
                  >
                    <Lock size={14} />
                    إغلاق الوردية
                  </Button>`;

const newButton = `<Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsParkShiftCloseModalOpen(true)}
                    className="rounded-xl text-xs font-bold gap-1.5 cursor-pointer border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-900/20"
                  >
                    <History size={14} />
                    سجل إغلاق الورديات
                  </Button>`;

content = content.replace(oldButton, newButton);

fs.writeFileSync("src/routes/admin/mall.tsx", content);
console.log("Success fixed mall button");
