<?php
namespace App\Core;

/**
 * Lightweight Pure PHP PDF Generator
 * Creates valid PDF-1.4 documents without requiring any external extensions or composer libraries.
 */
class PdfHelper {
    public static function createStandardPdf(string $title, array $lines = []): string {
        $cleanTitle = str_replace(['\\', '(', ')'], ['', '', ''], $title);
        $stream = "BT\n";
        $stream .= "/F2 16 Tf\n";
        $stream .= "50 740 Td\n";
        $stream .= "(" . self::escape($cleanTitle) . ") Tj\n";
        $stream .= "ET\n";

        // Horizontal Rule
        $stream .= "0.3 w\n0.2 0.3 0.6 RG\n";
        $stream .= "50 725 m 562 725 l S\n";

        $y = 690;
        foreach ($lines as $line) {
            $fontSize = $line['size'] ?? 11;
            $fontName = !empty($line['bold']) ? '/F2' : '/F1';
            $text = $line['text'] ?? '';
            $color = $line['color'] ?? '0 0 0';

            $stream .= "BT\n";
            $stream .= "{$color} rg\n";
            $stream .= "{$fontName} {$fontSize} Tf\n";
            $stream .= "50 {$y} Td\n";
            $stream .= "(" . self::escape($text) . ") Tj\n";
            $stream .= "ET\n";

            $y -= ($line['spacing'] ?? 20);
        }

        // Footer
        $stream .= "0.6 0.6 0.6 RG\n0.1 w\n";
        $stream .= "50 50 m 562 50 l S\n";
        $stream .= "BT\n0.4 0.4 0.4 rg\n/F1 9 Tf\n";
        $stream .= "50 35 Td\n";
        $stream .= "(Kingdom of Bahrain - Ministry of Labour / General Placement Registry - Official Document) Tj\n";
        $stream .= "ET\n";

        $streamLen = strlen($stream);

        $out = "%PDF-1.4\n";
        $offsets = [];

        $offsets[1] = strlen($out);
        $out .= "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";

        $offsets[2] = strlen($out);
        $out .= "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";

        $offsets[3] = strlen($out);
        $out .= "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n";

        $offsets[4] = strlen($out);
        $out .= "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n";

        $offsets[5] = strlen($out);
        $out .= "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n";

        $offsets[6] = strlen($out);
        $out .= "6 0 obj\n<< /Length {$streamLen} >>\nstream\n" . $stream . "\nendstream\nendobj\n";

        $xrefOffset = strlen($out);
        $out .= "xref\n0 7\n";
        $out .= "0000000000 65535 f \n";
        for ($i = 1; $i <= 6; $i++) {
            $out .= sprintf("%010d 00000 n \n", $offsets[$i]);
        }

        $out .= "trailer\n<< /Size 7 /Root 1 0 R >>\n";
        $out .= "startxref\n{$xrefOffset}\n%%EOF";

        return $out;
    }

    private static function escape(string $str): string {
        $str = str_replace('\\', '\\\\', $str);
        $str = str_replace('(', '\\(', $str);
        $str = str_replace(')', '\\)', $str);
        return $str;
    }
}
