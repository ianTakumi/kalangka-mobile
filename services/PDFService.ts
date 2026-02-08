import RNHTMLtoPDF from "react-native-html-to-pdf";
import RNFS from "react-native-fs";
import QRCode from "qrcode";
import { Tree } from "@/types/index";

class PDFService {
  static async generateTreesPDF(trees: Tree[]): Promise<string> {
    try {
      // Generate HTML content for each tree on separate pages
      const treePages = await Promise.all(
        trees.map(async (tree, index) => {
          // Generate QR code for tree ID
          const qrCodeData = `tree://${tree.id}`; // Custom URL scheme
          const qrCodeImage = await QRCode.toDataURL(qrCodeData, {
            width: 150,
            margin: 1,
            color: {
              dark: "#000000",
              light: "#FFFFFF",
            },
          });

          return `
            <div style="page-break-after: always; padding: 40px; font-family: Arial, sans-serif;">
              <!-- Header -->
              <div style="text-align: center; margin-bottom: 40px; border-bottom: 2px solid #059669; padding-bottom: 20px;">
                <h1 style="color: #059669; margin: 0;">Tree Information</h1>
                <p style="color: #6b7280; margin-top: 5px;">Tree ID: ${tree.id}</p>
              </div>
              
              <!-- Main Content -->
              <div style="display: flex; flex-direction: column; align-items: center;">
                <!-- QR Code -->
                <div style="margin-bottom: 30px; text-align: center;">
                  <h2 style="color: #374151; margin-bottom: 15px;">Scan QR Code</h2>
                  <img 
                    src="${qrCodeImage}" 
                    alt="QR Code for Tree ${tree.id}" 
                    style="width: 150px; height: 150px; border: 1px solid #e5e7eb; padding: 10px; background: white;"
                  />
                  <p style="color: #6b7280; font-size: 12px; margin-top: 10px;">
                    Scan to view tree details
                  </p>
                </div>
                
                <!-- Tree Details -->
                <div style="width: 100%; max-width: 600px; background: #f9fafb; padding: 25px; border-radius: 10px; border: 1px solid #e5e7eb;">
                  <h2 style="color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-top: 0;">Tree Details</h2>
                  
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 10px 0; color: #6b7280; width: 120px;"><strong>Description:</strong></td>
                      <td style="padding: 10px 0; color: #374151;">${tree.description || "N/A"}</td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0; color: #6b7280;"><strong>Type:</strong></td>
                      <td style="padding: 10px 0; color: #374151;">${tree.type || "N/A"}</td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0; color: #6b7280;"><strong>Status:</strong></td>
                      <td style="padding: 10px 0; color: #374151;">
                        <span style="background-color: ${tree.status === "active" ? "#10b981" : "#6b7280"}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px;">
                          ${tree.status}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0; color: #6b7280;"><strong>Location:</strong></td>
                      <td style="padding: 10px 0; color: #374151;">
                        ${tree.latitude.toFixed(6)}, ${tree.longitude.toFixed(6)}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0; color: #6b7280;"><strong>Created:</strong></td>
                      <td style="padding: 10px 0; color: #374151;">
                        ${tree.created_at ? new Date(tree.created_at).toLocaleDateString() : "N/A"}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0; color: #6b7280;"><strong>Sync Status:</strong></td>
                      <td style="padding: 10px 0; color: #374151;">
                        <span style="color: ${tree.is_synced ? "#059669" : "#d97706"};">
                          ${tree.is_synced ? "✓ Synced" : "⏳ Pending"}
                        </span>
                      </td>
                    </tr>
                  </table>
                </div>
                
                <!-- Footer -->
                <div style="margin-top: 40px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                  <p>Page ${index + 1} of ${trees.length} • Generated on ${new Date().toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          `;
        }),
      );

      // Combine all pages
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            @page {
              margin: 40px;
              size: A4;
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
              color: #374151;
            }
            table {
              width: 100%;
            }
            tr:nth-child(even) {
              background-color: #f8fafc;
            }
          </style>
        </head>
        <body>
          ${treePages.join("")}
        </body>
        </html>
      `;

      // Generate PDF
      const options = {
        html: htmlContent,
        fileName: `trees_${new Date().toISOString().split("T")[0]}`,
        directory: "Documents",
        base64: false,
      };

      const file = await RNHTMLtoPDF.convert(options);

      if (!file.filePath) {
        throw new Error("PDF generation failed");
      }

      return file.filePath;
    } catch (error) {
      console.error("PDF generation error:", error);
      throw error;
    }
  }

  static async deletePDF(filePath: string): Promise<void> {
    try {
      if (await RNFS.exists(filePath)) {
        await RNFS.unlink(filePath);
      }
    } catch (error) {
      console.error("Delete PDF error:", error);
    }
  }
}

export default PDFService;
