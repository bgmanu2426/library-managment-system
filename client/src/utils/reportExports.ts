import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ReportData {
  totalUsers: number;
  totalBooks: number;
  issuedBooks: number;
  overdueBooks: number;
  newUsersThisMonth: number;
  booksAddedThisMonth: number;
  popularGenres: Array<{
    name: string;
    count: number;
    percentage: number;
  }>;
  monthlyIssues: Array<{
    month: string;
    issues: number;
    returns: number;
  }>;
  topBorrowers: Array<{
    name: string;
    usn: string;
    books: number;
  }>;
  mostIssuedBooks: Array<{
    title: string;
    author: string;
    issueCount: number;
    genre: string;
  }>;
  weeklyTrends: Array<{
    day: string;
    issues: number;
    returns: number;
  }>;
}

export const exportToPDF = (data: ReportData, dateRange: string, reportType: string) => {
  const doc = new jsPDF();
  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const formattedTime = currentDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  // Set up colors
  const primaryColor = [59, 130, 246]; // Blue
  const secondaryColor = [16, 185, 129]; // Emerald
  const textColor = [31, 41, 55]; // Gray-800
  const lightGray = [243, 244, 246]; // Gray-100

  // Header with gradient effect (simulated with rectangles)
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 210, 45, 'F');
  
  // Add a more sophisticated library logo
  doc.setFillColor(255, 255, 255);
  doc.circle(25, 22, 10, 'F');
  
  // Create a book icon using rectangles and lines
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(19, 17, 12, 10, 'F'); // Book body
  doc.setFillColor(255, 255, 255);
  doc.rect(20, 18, 10, 1, 'F'); // Book lines
  doc.rect(20, 20, 10, 1, 'F');
  doc.rect(20, 22, 10, 1, 'F');
  doc.rect(20, 24, 10, 1, 'F');

  // Title with better positioning
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('Library Management System', 45, 22);
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  doc.text('Analytics Report', 45, 32);

  // Report metadata with better spacing
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFontSize(10);
  doc.text(`Report Type: ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}`, 14, 60);
  doc.text(`Date Range: ${dateRange.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}`, 14, 67);
  doc.text(`Generated: ${formattedDate} at ${formattedTime}`, 14, 74);

  let yPosition = 90;

  // Key Metrics Section with proper icon
  doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
  doc.rect(14, yPosition - 5, 182, 8, 'F');
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text('Key Metrics', 18, yPosition);
  yPosition += 15;

  // Metrics in a grid layout with better alignment
  const metrics = [
    { label: 'Total Users', value: data.totalUsers.toString(), change: `+${data.newUsersThisMonth} this month` },
    { label: 'Total Books', value: data.totalBooks.toString(), change: `+${data.booksAddedThisMonth} this month` },
    { label: 'Currently Issued', value: data.issuedBooks.toString(), change: `${Math.round((data.issuedBooks / data.totalBooks) * 100)}% of collection` },
    { label: 'Overdue Books', value: data.overdueBooks.toString(), change: 'Require attention' }
  ];

  metrics.forEach((metric, index) => {
    const x = 14 + (index % 2) * 90;
    const y = yPosition + Math.floor(index / 2) * 25;
    
    // Metric box with better styling
    doc.setFillColor(255, 255, 255);
    doc.rect(x, y - 5, 85, 20, 'F');
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    doc.rect(x, y - 5, 85, 20, 'S');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text(metric.label, x + 5, y + 2);
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text(metric.value, x + 5, y + 10);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text(metric.change, x + 5, y + 16);
  });

  yPosition += 60;

  // Popular Genres Section
  doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
  doc.rect(14, yPosition - 5, 182, 8, 'F');
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text('Popular Genres', 18, yPosition);
  yPosition += 15;

  data.popularGenres.forEach((genre, index) => {
    const barWidth = (genre.percentage / 100) * 150;
    const colors = [
      [59, 130, 246],   // Blue
      [16, 185, 129],   // Emerald
      [139, 92, 246],   // Purple
      [245, 158, 11]    // Amber
    ];
    const color = colors[index % colors.length];
    
    doc.setFontSize(10);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text(`${genre.name} (${genre.count} books)`, 18, yPosition + 5);
    
    // Progress bar background
    doc.setFillColor(229, 231, 235);
    doc.rect(18, yPosition + 7, 150, 4, 'F');
    
    // Progress bar fill
    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(18, yPosition + 7, barWidth, 4, 'F');
    
    // Percentage
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(`${genre.percentage}%`, 175, yPosition + 10);
    
    yPosition += 18;
  });

  // Add new page for tables
  doc.addPage();
  yPosition = 20;

  // Top Borrowers Table
  doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
  doc.rect(14, yPosition - 5, 182, 8, 'F');
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text('Top Borrowers', 18, yPosition);
  yPosition += 15;

  autoTable(doc, {
    startY: yPosition,
    head: [['Rank', 'Name', 'USN', 'Books Borrowed']],
    body: data.topBorrowers.map((borrower, index) => [
      `#${index + 1}`,
      borrower.name,
      borrower.usn,
      borrower.books.toString()
    ]),
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
      halign: 'center'
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251]
    },
    styles: {
      fontSize: 10,
      cellPadding: 5,
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 30, halign: 'center' },
      1: { cellWidth: 60, halign: 'left' },
      2: { cellWidth: 40, halign: 'center' },
      3: { cellWidth: 40, halign: 'center' }
    }
  });

  yPosition = (doc as any).lastAutoTable.finalY + 20;

  // Most Issued Books Table
  doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
  doc.rect(14, yPosition - 5, 182, 8, 'F');
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text('Most Issued Books', 18, yPosition);
  yPosition += 15;

  autoTable(doc, {
    startY: yPosition,
    head: [['Title', 'Author', 'Genre', 'Issues']],
    body: data.mostIssuedBooks.map(book => [
      book.title,
      book.author,
      book.genre,
      book.issueCount.toString()
    ]),
    theme: 'grid',
    headStyles: {
      fillColor: secondaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
      halign: 'center'
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251]
    },
    styles: {
      fontSize: 9,
      cellPadding: 4,
      halign: 'left'
    },
    columnStyles: {
      0: { cellWidth: 70, halign: 'left' },
      1: { cellWidth: 50, halign: 'left' },
      2: { cellWidth: 35, halign: 'center' },
      3: { cellWidth: 25, halign: 'center' }
    }
  });

  // Weekly Trends Chart (simplified as text)
  yPosition = (doc as any).lastAutoTable.finalY + 20;
  
  if (yPosition > 250) {
    doc.addPage();
    yPosition = 20;
  }

  doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
  doc.rect(14, yPosition - 5, 182, 8, 'F');
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text('Weekly Circulation Trends', 18, yPosition);
  yPosition += 15;

  autoTable(doc, {
    startY: yPosition,
    head: [['Day', 'Issues', 'Returns', 'Net Change']],
    body: data.weeklyTrends.map(day => [
      day.day,
      day.issues.toString(),
      day.returns.toString(),
      (day.issues - day.returns).toString()
    ]),
    theme: 'grid',
    headStyles: {
      fillColor: [139, 92, 246], // Purple
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
      halign: 'center'
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251]
    },
    styles: {
      fontSize: 10,
      cellPadding: 5,
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 40, halign: 'center' },
      1: { cellWidth: 40, halign: 'center' },
      2: { cellWidth: 40, halign: 'center' },
      3: { cellWidth: 40, halign: 'center' }
    }
  });

  // Footer with better formatting
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    
    // Add a line above footer
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    doc.line(14, 280, 196, 280);
    
    doc.text(`Page ${i} of ${pageCount}`, 14, 285);
    doc.text('Generated by Library Management System', 105, 285, { align: 'center' });
    doc.text(`© ${new Date().getFullYear()} Library Management`, 196, 285, { align: 'right' });
  }

  // Save the PDF
  const fileName = `library-report-${reportType}-${currentDate.toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};

export const exportToCSV = (data: ReportData, dateRange: string, reportType: string) => {
  const currentDate = new Date();
  const formattedDateTime = currentDate.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  let csvContent = '';
  
  // Header information
  csvContent += `Library Management System - Analytics Report\n`;
  csvContent += `Report Type,${reportType.charAt(0).toUpperCase() + reportType.slice(1)}\n`;
  csvContent += `Date Range,${dateRange.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}\n`;
  csvContent += `Generated,${formattedDateTime}\n`;
  csvContent += `\n`;

  // Key Metrics
  csvContent += `KEY METRICS\n`;
  csvContent += `Metric,Value,Additional Info\n`;
  csvContent += `Total Users,${data.totalUsers},+${data.newUsersThisMonth} this month\n`;
  csvContent += `Total Books,${data.totalBooks},+${data.booksAddedThisMonth} this month\n`;
  csvContent += `Currently Issued,${data.issuedBooks},${Math.round((data.issuedBooks / data.totalBooks) * 100)}% of collection\n`;
  csvContent += `Overdue Books,${data.overdueBooks},Require attention\n`;
  csvContent += `\n`;

  // Popular Genres
  csvContent += `POPULAR GENRES\n`;
  csvContent += `Genre,Book Count,Percentage\n`;
  data.popularGenres.forEach(genre => {
    csvContent += `${genre.name},${genre.count},${genre.percentage}%\n`;
  });
  csvContent += `\n`;

  // Top Borrowers
  csvContent += `TOP BORROWERS\n`;
  csvContent += `Rank,Name,USN,Books Borrowed\n`;
  data.topBorrowers.forEach((borrower, index) => {
    csvContent += `${index + 1},"${borrower.name}",${borrower.usn},${borrower.books}\n`;
  });
  csvContent += `\n`;

  // Most Issued Books
  csvContent += `MOST ISSUED BOOKS\n`;
  csvContent += `Title,Author,Genre,Issue Count\n`;
  data.mostIssuedBooks.forEach(book => {
    csvContent += `"${book.title}","${book.author}",${book.genre},${book.issueCount}\n`;
  });
  csvContent += `\n`;

  // Weekly Trends
  csvContent += `WEEKLY CIRCULATION TRENDS\n`;
  csvContent += `Day,Issues,Returns,Net Change\n`;
  data.weeklyTrends.forEach(day => {
    csvContent += `${day.day},${day.issues},${day.returns},${day.issues - day.returns}\n`;
  });
  csvContent += `\n`;

  // Monthly Issues
  csvContent += `MONTHLY CIRCULATION\n`;
  csvContent += `Month,Issues,Returns,Net Change\n`;
  data.monthlyIssues.forEach(month => {
    csvContent += `${month.month},${month.issues},${month.returns},${month.issues - month.returns}\n`;
  });

  // Create and download the file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `library-report-${reportType}-${currentDate.toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};