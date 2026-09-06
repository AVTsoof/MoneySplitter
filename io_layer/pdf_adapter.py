import re
from pathlib import Path
from fpdf import FPDF
from datetime import datetime
from decimal import Decimal
from typing import List, Dict, Any
from core.constants import get_currency_symbol

FONTS_DIR = Path(__file__).resolve().parents[1] / "data" / "fonts"
DEJAVU_REGULAR = FONTS_DIR / "DejaVuSans.ttf"
DEJAVU_BOLD = FONTS_DIR / "DejaVuSans-Bold.ttf"

HEBREW_OR_RTL_REGEX = re.compile(r'[\u0590-\u05fe\u0600-\u06ff\u0750-\u077f\ufb50-\ufdff\ufe70-\ufeff]')


def format_bidi(text: Any) -> Any:
    """Reorders bidirectional text (such as Hebrew or Arabic) for proper visual rendering in LTR cells."""
    if not text or not isinstance(text, str):
        return text
    if not HEBREW_OR_RTL_REGEX.search(text):
        return text
    try:
        from fpdf.bidi import BidiParagraph
        return BidiParagraph(text).get_reordered_string()
    except Exception:
        return text


class PDFReportGenerator(FPDF):
    """
    Generates professional PDF reports for MoneySplitter groups.
    Inherits from FPDF to provide PDF generation with custom styling and Unicode/Hebrew support.
    """
    
    def __init__(self, group_name: str, members: List[str], title: str = "MoneySplitter Report"):
        super().__init__(orientation='P', unit='mm', format='A4')
        self.app_font = self._init_fonts()
        self.group_name = group_name
        self.members = members
        self.title = title
        self.generated_at = datetime.now()
        self.set_auto_page_break(auto=True, margin=15)
        self.add_page()
        self._add_title_page()

    def _init_fonts(self) -> str:
        """Register Unicode font (DejaVu Sans) if available, with style fallbacks."""
        if DEJAVU_REGULAR.exists():
            self.add_font("DejaVu", "", str(DEJAVU_REGULAR))
            self.add_font("DejaVu", "I", str(DEJAVU_REGULAR))
            if DEJAVU_BOLD.exists():
                self.add_font("DejaVu", "B", str(DEJAVU_BOLD))
                self.add_font("DejaVu", "BI", str(DEJAVU_BOLD))
            else:
                self.add_font("DejaVu", "B", str(DEJAVU_REGULAR))
                self.add_font("DejaVu", "BI", str(DEJAVU_REGULAR))
            return "DejaVu"
        return "Helvetica"

    def cell(self, *args, **kwargs):
        """Override cell to automatically handle RTL / Hebrew text."""
        if "text" in kwargs:
            kwargs["text"] = format_bidi(kwargs["text"])
        elif "txt" in kwargs:
            kwargs["txt"] = format_bidi(kwargs["txt"])
        elif len(args) >= 3:
            args = list(args)
            args[2] = format_bidi(args[2])
            args = tuple(args)
        return super().cell(*args, **kwargs)

    def multi_cell(self, *args, **kwargs):
        """Override multi_cell to automatically handle RTL / Hebrew text."""
        if "text" in kwargs:
            kwargs["text"] = format_bidi(kwargs["text"])
        elif "txt" in kwargs:
            kwargs["txt"] = format_bidi(kwargs["txt"])
        elif len(args) >= 3:
            args = list(args)
            args[2] = format_bidi(args[2])
            args = tuple(args)
        return super().multi_cell(*args, **kwargs)
    
    def _add_title_page(self):
        """Add the title page with group information."""
        self.set_font(self.app_font, "B", 28)
        self.cell(0, 15, self.title, ln=True, align="C")
        
        self.set_font(self.app_font, "", 12)
        self.ln(10)
        self.cell(0, 8, f"Group: {self.group_name}", ln=True, align="C")
        self.cell(0, 8, f"Members: {', '.join(self.members)}", ln=True, align="C")
        self.cell(0, 8, f"Generated: {self.generated_at.strftime('%Y-%m-%d %H:%M:%S')}", ln=True, align="C")
        
        self.ln(10)
        self.line(10, self.get_y(), 200, self.get_y())
    
    def add_section_header(self, title: str):
        """Add a section header, always starting on a new page."""
        self.add_page()
        self.set_font(self.app_font, "B", 16)
        self.set_text_color(33, 81, 158)  # Dark blue
        self.cell(0, 12, title, ln=True)
        self.set_text_color(0, 0, 0)  # Reset to black
        self.set_font(self.app_font, "", 11)
        self.ln(3)
    
    def add_subsection_header(self, title: str):
        """Add a subsection header."""
        self.ln(5)
        self.set_font(self.app_font, "B", 13)
        self.set_text_color(70, 130, 180)  # Steel blue
        self.cell(0, 10, title, ln=True)
        self.set_text_color(0, 0, 0)
        self.set_font(self.app_font, "", 11)
    
    def _calc_row_height(self, row: List[str], col_widths: List[int], line_height: float = 6.0) -> float:
        """
        Calculate the required height for a table row by checking how many
        lines each cell needs when text is wrapped.
        """
        max_lines = 1
        for cell_text, width in zip(row, col_widths):
            # Estimate characters that fit per line (font size 10, ~1.8 chars/mm)
            chars_per_line = max(1, int(width / 1.85))
            text = str(cell_text)
            # Count natural newlines and wrapping
            lines = 0
            for segment in text.split('\n'):
                lines += max(1, -(-len(segment) // chars_per_line))  # ceiling division
            max_lines = max(max_lines, lines)
        return max_lines * line_height

    def add_data_table(self, headers: List[str], rows: List[List[str]], col_widths: List[int] = None):
        """
        Add a formatted data table to the PDF.
        Long cell text is wrapped across multiple lines instead of being truncated.
        
        Args:
            headers: List of column headers
            rows: List of rows (each row is a list of strings)
            col_widths: List of column widths in mm (optional)
        """
        LINE_H = 6.0  # line height in mm

        if col_widths is None:
            col_widths = [190 // len(headers)] * len(headers)
        
        # Header row
        self.set_font(self.app_font, "B", 10)
        self.set_fill_color(33, 81, 158)  # Dark blue background
        self.set_text_color(255, 255, 255)  # White text
        
        for header, width in zip(headers, col_widths):
            self.cell(width, 8, header, border=1, align="C", fill=True)
        self.ln()
        
        # Data rows
        self.set_font(self.app_font, "", 10)
        self.set_text_color(0, 0, 0)
        
        for row_idx, row in enumerate(rows):
            row_strs = [str(c) for c in row]
            row_h = self._calc_row_height(row_strs, col_widths, LINE_H)

            # Page-break check: if the row won't fit, start a new page and
            # re-draw the header row so the table is readable.
            if self.get_y() + row_h > self.page_break_trigger:
                self.add_page()
                self.set_font(self.app_font, "B", 10)
                self.set_fill_color(33, 81, 158)
                self.set_text_color(255, 255, 255)
                for header, width in zip(headers, col_widths):
                    self.cell(width, 8, header, border=1, align="C", fill=True)
                self.ln()
                self.set_font(self.app_font, "", 10)
                self.set_text_color(0, 0, 0)

            if row_idx % 2 == 0:
                fill_color = (240, 245, 250)  # Light blue
            else:
                fill_color = (255, 255, 255)  # White

            x_start = self.get_x()
            y_start = self.get_y()

            for cell_text, width in zip(row_strs, col_widths):
                self.set_fill_color(*fill_color)
                x_cell = self.get_x()
                # multi_cell moves Y; we'll restore it after each cell
                self.multi_cell(
                    width, LINE_H, cell_text,
                    border=1, align="C", fill=True,
                    max_line_height=LINE_H,
                )
                # Reposition to the right of the cell we just drew, same Y as row start
                self.set_xy(x_cell + width, y_start)

            # Move to the next row
            self.set_xy(x_start, y_start + row_h)
    
    def add_text_info(self, label: str, value: str, bold_value: bool = False):
        """Add a label-value pair (e.g., 'Balance: $100.00')."""
        self.set_font(self.app_font, "B", 11)
        self.cell(60, 8, label)
        
        if bold_value:
            self.set_font(self.app_font, "B", 11)
        else:
            self.set_font(self.app_font, "", 11)
        self.cell(0, 8, value, ln=True)
    
    def _convert_to_default(self, amount: Decimal, currency: str, default_currency: str, exchange_rates: dict) -> str:
        """
        Convert *amount* from *currency* to *default_currency* using the stored
        exchange-rate data.  Returns a formatted string or '-' if conversion
        is not possible.
        """
        currency = currency.upper()
        default_currency = default_currency.upper()
        if currency == default_currency:
            return f"{amount:.2f}"
        rates_dict = exchange_rates.get('rates', {}) if exchange_rates else {}
        # Build flat map (all vs USD/API base)
        api_base = exchange_rates.get('base', 'USD').upper() if exchange_rates else 'USD'
        all_rates: Dict[str, float] = {api_base: 1.0}
        for cur, r in rates_dict.items():
            if isinstance(r, (int, float, Decimal)):
                all_rates[cur.upper()] = float(r)
        # Convert: amount_in_default = amount * (default_rate / currency_rate)
        currency_rate = all_rates.get(currency)
        default_rate = all_rates.get(default_currency)
        if not currency_rate or not default_rate:
            return "-"
        converted = float(amount) * (default_rate / currency_rate)
        return f"{converted:.2f}"

    def add_transactions_section(self, transactions: List[Any], exchange_rates: dict = None, default_currency: str = None):
        """Add the transactions section to the PDF."""
        self.add_section_header("Transaction History")
        
        if not transactions:
            self.set_font(self.app_font, "I", 11)
            self.cell(0, 8, "No transactions recorded.", ln=True)
            return
        
        # Group transactions by date
        from itertools import groupby
        from datetime import date
        
        transactions_sorted = sorted(transactions, key=lambda x: x.timestamp, reverse=True)
        
        dc_label = default_currency or "default"
        headers = ["Type", "Description", "Paid/From", "For/To", "Amount", "Currency", f"Amount ({dc_label})"]
        
        for date_key, group in groupby(transactions_sorted, key=lambda x: x.timestamp.date()):
            group_list = list(group)
            self.add_subsection_header(date_key.strftime("%A, %B %d, %Y"))
            
            rows = []
            
            for tx in group_list:
                tx_type = "Expense" if hasattr(tx, 'participants') else "Transfer"
                
                if tx_type == "Expense":
                    amount = tx.amount
                    to_from = ", ".join(tx.participants)
                else:
                    amount = tx.amount
                    to_from = tx.receiver
                
                if default_currency and exchange_rates:
                    default_amt = self._convert_to_default(amount, tx.currency, default_currency, exchange_rates)
                else:
                    default_amt = "-"
                
                rows.append([
                    tx_type,
                    getattr(tx, 'description', ''),
                    tx.payer if hasattr(tx, 'payer') else tx.sender,
                    to_from,
                    str(amount),
                    tx.currency,
                    default_amt
                ])
            
            self.add_data_table(headers, rows, col_widths=[20, 42, 30, 30, 24, 18, 26])
    
    def add_balances_section(self, balances: Dict[str, Decimal], currency: str):
        """Add the balances section to the PDF."""
        self.add_section_header("Net Balances")
        self.add_text_info("Currency:", currency)
        self.ln(3)
        
        if not balances or not any(abs(v) > Decimal('0.001') for v in balances.values()):
            self.set_font(self.app_font, "I", 11)
            self.set_text_color(40, 167, 69)  # Green
            self.cell(0, 8, "Everyone is settled up!", ln=True)
            self.set_text_color(0, 0, 0)
            return
        
        symbol = f"{currency} "
        headers = ["Member", "Balance", f"Amount ({currency})"]
        rows = []
        
        for member in self.members:
            balance = balances.get(member, Decimal('0'))
            if abs(balance) > Decimal('0.001'):
                if balance > 0:
                    balance_str = "IS OWED"
                else:
                    balance_str = "OWES"
                rows.append([member, balance_str, f"{abs(balance):.2f}"])
        
        self.add_data_table(headers, rows, col_widths=[70, 80, 40])
    
    def add_settlements_section(self, simplified_debts: List[Dict[str, Any]], currency: str):
        """Add the settlements section to the PDF."""
        self.add_section_header("Settlement Transactions")
        self.add_text_info("Currency:", currency)
        self.ln(3)
        
        if not simplified_debts:
            self.set_font(self.app_font, "I", 11)
            self.cell(0, 8, "No active debts.", ln=True)
            return
        
        symbol = f"{currency} "
        headers = ["From", "To", f"Amount ({currency})"]
        rows = []
        
        for debt in simplified_debts:
            amt = debt.get('amount', 0)
            if isinstance(amt, (int, float, Decimal)):
                amt_str = f"{amt:.2f}"
            else:
                amt_str = str(amt)
            rows.append([
                debt.get('from', ''),
                debt.get('to', ''),
                amt_str
            ])
        
        self.add_data_table(headers, rows, col_widths=[63, 63, 64])
    
    def add_exchange_rates_section(
        self,
        rates: Dict[str, Dict[str, float]],
        active_currencies: List[str] = None,
        default_currency: str = None,
    ):
        """
        Add the exchange rates section to the PDF.
        Rates are rebased so that *default_currency* is shown as 1.00 and all
        other active currencies are expressed relative to it.
        Only currencies present in *active_currencies* (from group settings)
        are shown.  Pass None to show all available currencies.
        """
        self.add_section_header("Exchange Rates")
        
        if not rates or 'rates' not in rates:
            self.set_font(self.app_font, "I", 11)
            self.cell(0, 8, "No exchange rate data available.", ln=True)
            return
        
        rates_dict = rates.get('rates', {})
        
        if not rates_dict:
            self.set_font(self.app_font, "I", 11)
            self.cell(0, 8, "No exchange rate data available.", ln=True)
            return

        # Determine the pivot currency (default_currency takes precedence over
        # whatever base the API used).
        api_base = rates.get('base', 'USD')
        pivot = (default_currency or api_base).upper()

        # Build a flat map of every currency -> rate vs the api_base.
        # The api_base itself has rate 1.0 by definition.
        all_rates: Dict[str, float] = {api_base: 1.0}
        for cur, r in rates_dict.items():
            if isinstance(r, (int, float, Decimal)):
                all_rates[cur.upper()] = float(r)

        # Rebase: rate_vs_pivot = rate_vs_api_base / pivot_vs_api_base
        pivot_rate = all_rates.get(pivot)
        if not pivot_rate:
            # Pivot not found – fall back to api_base
            pivot = api_base
            pivot_rate = 1.0

        # Normalise the active-currencies filter (upper-case)
        if active_currencies:
            allowed = {c.upper() for c in active_currencies}
        else:
            allowed = None  # show everything

        headers = ["Currency", f"1 {pivot} ="]
        rows = []

        # Always show the pivot first at 1.00
        if allowed is None or pivot in allowed:
            rows.append([pivot, "1.0000"])

        for currency in sorted(all_rates.keys()):
            if currency == pivot:
                continue
            if allowed is not None and currency not in allowed:
                continue
            rebased = all_rates[currency] / pivot_rate
            rows.append([currency, f"{rebased:.4f}"])
        
        if rows:
            self.add_data_table(headers, rows, col_widths=[95, 95])
        else:
            self.set_font(self.app_font, "I", 11)
            self.cell(0, 8, "No exchange rate data available for the active currencies.", ln=True)
    
    def add_settings_summary_section(self, settings: Dict[str, Any]):
        """Add the settings summary section to the PDF."""
        self.add_section_header("Group Settings")
        
        self.add_text_info("Group Name:", settings.get('name', 'N/A'))
        self.add_text_info("Default Currency:", settings.get('default_currency', 'N/A'))
        self.add_text_info("Active Currencies:", ", ".join(settings.get('active_currencies', [])))
        self.add_text_info("Members:", str(len(self.members)))
        
        self.ln(5)
        self.add_subsection_header("Members")
        
        headers = ["Member Name"]
        rows = [[member] for member in self.members]
        self.add_data_table(headers, rows, col_widths=[190])
    
    def generate_pdf_bytes(self) -> bytes:
        """Return the PDF as bytes."""
        return bytes(self.output())

