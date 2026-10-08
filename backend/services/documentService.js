// Helper to determine document type from filename / mimetype
export function detectDocumentType(file) {
  const name = file.originalname.toLowerCase();
  const mime = file.mimetype;

  if (mime === "application/pdf" || name.endsWith(".pdf")) {
    return {
      type: "PDF Document",
      category: "PDF",
      format: "PDF",
      description: "Portable Document Format",
    };
  }
  if (
    mime === "application/msword" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".doc") ||
    name.endsWith(".docx")
  ) {
    return {
      type: "Microsoft Word Document",
      category: "Word Document",
      format: name.endsWith(".docx") ? "DOCX" : "DOC",
      description: "Editable Word Processing Document",
    };
  }
  if (
    mime.startsWith("text/") ||
    name.endsWith(".txt") ||
    name.endsWith(".md")
  ) {
    return {
      type: "Text Document",
      category: "Plain Text",
      format: "TXT",
      description: "Unformatted Plain Text File",
    };
  }
  if (
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    name.endsWith(".xlsx") ||
    name.endsWith(".csv")
  ) {
    return {
      type: "Spreadsheet Document",
      category: "Spreadsheet",
      format: name.endsWith(".csv") ? "CSV" : "XLSX",
      description: "Tabular Data Document",
    };
  }
  return {
    type: "Generic Document",
    category: "Other Document",
    format: name.split(".").pop()?.toUpperCase() || "UNKNOWN",
    description: "Standard Digital File",
  };
}
