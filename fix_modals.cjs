const fs = require("fs");
let content = fs.readFileSync("src/routes/admin/mall.tsx", "utf8");

// 1. Remove the old ParkShiftClosingModal component
content = content.replace(
  /<ParkShiftClosingModal[\s\S]*?onShiftClosed=\{\(\) => setIsParkShiftCloseModalOpen\(false\)\}\n\s*\/>/g,
  "",
);

// 2. Update ParkShiftClosingReportModal
const oldReportModal = `<ParkShiftClosingReportModal
            isOpen={selectedClosedShiftForReport !== null || shiftToCloseFromLauncher !== null}
            onClose={() => {
              setSelectedClosedShiftForReport(null);
              setShiftToCloseFromLauncher(null);
            }}
            viewOnlyShift={selectedClosedShiftForReport}
            shiftToClose={shiftToCloseFromLauncher}
            onShiftClosed={() => {
              setShiftToCloseFromLauncher(null);
              setSelectedClosedShiftForReport(null);
            }}
          />`;

const newReportModal = `<ParkShiftClosingReportModal
            isOpen={isParkShiftCloseModalOpen || selectedClosedShiftForReport !== null || shiftToCloseFromLauncher !== null}
            onClose={() => {
              setIsParkShiftCloseModalOpen(false);
              setSelectedClosedShiftForReport(null);
              setShiftToCloseFromLauncher(null);
            }}
            viewOnlyShift={selectedClosedShiftForReport}
            shiftToClose={shiftToCloseFromLauncher}
            onShiftClosed={() => {
              setIsParkShiftCloseModalOpen(false);
              setShiftToCloseFromLauncher(null);
              setSelectedClosedShiftForReport(null);
            }}
          />`;

content = content.replace(oldReportModal, newReportModal);

// 3. Remove double state setting
content = content.replace(
  /setShiftToCloseFromLauncher\(s\);\n\s*setIsParkShiftCloseModalOpen\(true\);/g,
  "setShiftToCloseFromLauncher(s);",
);

fs.writeFileSync("src/routes/admin/mall.tsx", content);
console.log("Success fixed double modals");
