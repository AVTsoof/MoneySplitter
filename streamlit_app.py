import streamlit as st
import pandas as pd
from decimal import Decimal
from core.engine import Ledger, Expense, EqualSplitStrategy, DebtSimplifier, GroupSettings, Transfer, Transaction, ExactSplitStrategy, CurrencyConverter
import uuid
from io_layer.local_fs import LocalFileSystemIO
from bridge.orchestrator import Bridge

# Page configuration
st.set_page_config(
    page_title="MoneySplitter",
    page_icon="💸",
    layout="centered",
    initial_sidebar_state="collapsed"
)

# Custom CSS for "Simple Sharing" aesthetics
st.markdown("""
<style>
    .stApp {
        max-width: 500px;
        margin: 0 auto;
    }
    .stButton>button {
        width: 100%;
        border-radius: 12px;
        height: 3em;
        font-weight: bold;
    }
    .bill-card {
        padding: 15px;
        border-radius: 15px;
        margin-bottom: 10px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        border: 1px solid rgba(128, 128, 128, 0.3);
    }
    .balance-green {
        color: #28a745;
        font-weight: bold;
    }
    .balance-orange {
        color: #fd7e14;
        font-weight: bold;
    }
    .balance-neutral {
        color: #6c757d;
    }
</style>
""", unsafe_allow_html=True)

# Initialize Session State
from streamlit_agraph import agraph, Node, Edge, Config
import streamlit_agraph as sa
import json
from datetime import datetime, date, time

CURRENCY_SYMBOLS = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'ILS': '₪',
    'JPY': '¥',
    'CAD': 'C$',
    'AUD': 'A$',
}

def get_exchange_rate(from_curr, to_curr):
    if 'bridge' not in st.session_state:
        return Decimal('1.0')
    rates_data = st.session_state.bridge.get_exchange_rates().get("rates", {})
    return CurrencyConverter.get_exchange_rate(rates_data, from_curr, to_curr)

def get_symbol(currency_code):
    return CURRENCY_SYMBOLS.get(currency_code, f"{currency_code} ")

def agraph_fixed(nodes, edges, config, key=None):
    nodes_data = [node.to_dict() for node in nodes]
    edges_data = [edge.to_dict() for edge in edges]
    config_json = json.dumps(config.__dict__)
    data_json = json.dumps({"nodes": nodes_data, "edges": edges_data})
    return sa._agraph(data=data_json, config=config_json, key=key)

if 'users' not in st.session_state:
    st.session_state.users = ['You', 'Ariel', 'Bob', 'Charlie', 'David']
if 'current_user' not in st.session_state:
    st.session_state.current_user = 'You'
if 'graph_reset_key' not in st.session_state:
    st.session_state.graph_reset_key = 0
if 'group_settings' not in st.session_state:
    st.session_state.group_settings = {
        'default_currency': 'USD',
        'active_currencies': ['USD', 'EUR', 'ILS']
    }

# Initialize Bridge
if 'bridge' not in st.session_state:
    repo = LocalFileSystemIO()
    settings = GroupSettings(
        default_currency=st.session_state.group_settings['default_currency'],
        active_currencies=set(st.session_state.group_settings['active_currencies'])
    )
    st.session_state.bridge = Bridge(repo, current_user_id=st.session_state.current_user, group_id="default_group", settings=settings)

def get_ledger():
    return st.session_state.bridge.ledger

@st.dialog("➕ Add a Bill")
def add_bill_dialog():
    col1, col2 = st.columns([3, 1])
    with col1:
        description = st.text_input("What was it for? :red[*]", placeholder="e.g. Pizza")
    with col2:
        currency = st.selectbox("Currency", st.session_state.group_settings['active_currencies'], 
                              index=st.session_state.group_settings['active_currencies'].index(st.session_state.group_settings['default_currency']))
    
    amount = st.number_input("How much? :red[*]", min_value=0.0, value=0.0, step=1.0, format="%.2f")
    payer = st.selectbox("Who paid?", st.session_state.users)
    participants = st.multiselect("Who was there? :red[*]", st.session_state.users, default=st.session_state.users)
    
    split_method = st.radio("Split Method", ["Equally", "Unequally"], horizontal=True)
    
    exact_amounts = {}
    if split_method == "Unequally" and participants:
        st.write("Specify amounts for each person:")
        cols = st.columns(len(participants))
        for i, p in enumerate(participants):
            exact_amounts[p] = cols[i].number_input(f"{p}", min_value=0.0, value=0.0, step=1.0, format="%.2f", key=f"exact_{p}")
        
        current_sum = sum(exact_amounts.values())
        if abs(Decimal(str(current_sum)) - Decimal(str(amount))) > Decimal('0.001'):
            st.warning(f"Total: {current_sum:.2f} / {amount:.2f} (Difference: {abs(current_sum - amount):.2f})")
    elif split_method == "Equally" and participants and amount > 0:
        share = Decimal(str(amount)) / len(participants)
        st.caption(f"💡 Each person will pay: {get_symbol(currency)}{share:.2f}")
    
    col_d, col_t = st.columns(2)
    with col_d:
        bill_date = st.date_input("Date", value=date.today())
    with col_t:
        bill_time = st.time_input("Time", value=datetime.now().time())
    
    # Logic: Disable button until required fields are filled
    is_valid = description.strip() != "" and amount > 0 and len(participants) > 0
    if split_method == "Unequally":
        is_valid = is_valid and abs(Decimal(str(sum(exact_amounts.values()))) - Decimal(str(amount))) < Decimal('0.001')
    
    if st.button("Add Bill", use_container_width=True, type="primary", disabled=not is_valid):
        full_timestamp = datetime.combine(bill_date, bill_time)
        strategy = EqualSplitStrategy() if split_method == "Equally" else ExactSplitStrategy({k: Decimal(str(v)) for k, v in exact_amounts.items()})
        
        new_exp = Expense(
            id=str(uuid.uuid4()),
            payer=payer,
            total_amount=Decimal(str(amount)),
            participants=participants,
            description=description,
            currency=currency,
            strategy=strategy,
            timestamp=full_timestamp
        )
        st.session_state.bridge.add_transaction(new_exp)
        st.rerun()
    
    if not is_valid:
        if split_method == "Unequally" and amount > 0 and participants:
             st.caption("⚠️ The sum of individual amounts must equal the total amount.")
        else:
             st.caption("⚠️ Please provide a description and amount to enable the button.")

@st.dialog("💸 Add a Transfer")
def add_transfer_dialog():
    col1, col2 = st.columns([3, 1])
    with col1:
        description = st.text_input("Description", value="Transfer", placeholder="e.g. Payback")
    with col2:
        currency = st.selectbox("Currency", st.session_state.group_settings['active_currencies'], 
                              index=st.session_state.group_settings['active_currencies'].index(st.session_state.group_settings['default_currency']))
    
    amount = st.number_input("How much?", min_value=0.0, value=0.0, step=1.0, format="%.2f")
    col_f, col_t_user = st.columns(2)
    with col_f:
        sender = st.selectbox("From", st.session_state.users)
    with col_t_user:
        receiver = st.selectbox("To", st.session_state.users, index=1 if len(st.session_state.users) > 1 else 0)
    
    col_d, col_t = st.columns(2)
    with col_d:
        transfer_date = st.date_input("Date", value=date.today())
    with col_t:
        transfer_time = st.time_input("Time", value=datetime.now().time())
    
    is_valid = amount > 0 and sender != receiver
    
    if st.button("Add Transfer", use_container_width=True, type="primary", disabled=not is_valid):
        full_timestamp = datetime.combine(transfer_date, transfer_time)
        new_transfer = Transfer(
            id=str(uuid.uuid4()),
            sender=sender,
            receiver=receiver,
            amount=Decimal(str(amount)),
            currency=currency,
            description=description,
            timestamp=full_timestamp
        )
        st.session_state.bridge.add_transaction(new_transfer)
        st.rerun()
    
    if sender == receiver:
        st.caption("⚠️ Sender and Receiver must be different.")
    elif amount <= 0:
        st.caption("⚠️ Amount must be greater than 0.")

def render_transaction_summary(tx):
    symbol = get_symbol(tx.currency)
    default_curr = st.session_state.group_settings['default_currency']
    amount_display = f"{symbol}{tx.amount:.2f}"
    
    if tx.currency != default_curr:
        rate = get_exchange_rate(tx.currency, default_curr)
        default_amount = tx.amount * rate
        default_symbol = get_symbol(default_curr)
        amount_display += f" ({default_symbol}{default_amount:.2f})"
    
    date_str = tx.timestamp.strftime("%Y-%m-%d %H:%M")
    
    if isinstance(tx, Expense):
        details = f"Paid by {tx.payer}"
        split_type = "Equally" if isinstance(tx.strategy, EqualSplitStrategy) else "Unequally"
        sub_details = f"{len(tx.participants)} people • Split {split_type}"
        
        # Add share details
        share_info = "<br>".join([f"&nbsp;&nbsp;{p}: {symbol}{share:.2f}" for p, share in tx.shares.items()])
        sub_details += f"<div style='font-size: 0.85em; margin-top: 5px;'>{share_info}</div>"
    else:
        details = f"{tx.sender} ➔ {tx.receiver}"
        sub_details = "Direct Transfer"

    st.markdown(f"""
    <div class="bill-card">
        <div style="display: flex; justify-content: space-between; align-items: top;">
            <div>
                <span style="opacity: 0.7; font-size: 0.8em;">{date_str}</span><br>
                <b style="font-size: 1.1em;">{tx.description}</b><br>
                <span style="opacity: 0.7; font-size: 0.9em;">{details}</span>
            </div>
            <div style="text-align: right;">
                <span style="font-weight: bold; font-size: 1.1em;">{amount_display}</span><br>
                <span style="opacity: 0.6; font-size: 0.8em;">{sub_details}</span>
            </div>
        </div>
    </div>
    """, unsafe_allow_html=True)

@st.dialog("🗑️ Confirm Delete")
def confirm_delete_dialog(idx, tx):
    st.warning("Are you sure you want to delete this transaction?")
    render_transaction_summary(tx)
    st.write("This action cannot be undone.")
    if st.button("Yes, Delete", type="primary", use_container_width=True):
        st.session_state.bridge.delete_transaction(tx.id)
        st.toast("Deletion is not yet supported in this append-only phase.")
        st.rerun()

@st.dialog("💾 Confirm Save")
def confirm_save_dialog(idx, updated_tx):
    st.write("Save changes to this transaction?")
    render_transaction_summary(updated_tx)
    if st.button("Yes, Save Changes", type="primary", use_container_width=True):
        st.session_state.bridge.update_transaction(updated_tx)
        st.toast("Updating is not yet supported in this append-only phase.")
        st.rerun()

@st.dialog("🔄 Updating Conversion Table")
def update_rates_dialog():
    import time
    st.write("Fetching the latest exchange rates from the Frankfurter API...")
    st.caption("A 5-second timeout is active to prevent hanging.")
    
    with st.spinner("Please wait..."):
        success = st.session_state.bridge.update_exchange_rates(force=True, timeout=5.0)
        
    if success:
        st.success("Exchange rates updated successfully!")
        time.sleep(1.5)
        st.rerun()
    else:
        st.error("Request timed out or failed. Please check your internet connection and try again.")
        if st.button("Close", use_container_width=True):
            st.rerun()

def render_transaction_item(original_idx, tx):
    symbol = get_symbol(tx.currency)
    default_curr = st.session_state.group_settings['default_currency']
    
    amount_display = f"{symbol}{tx.amount:.2f}"
    if tx.currency != default_curr:
        rate = get_exchange_rate(tx.currency, default_curr)
        default_amount = tx.amount * rate
        default_symbol = get_symbol(default_curr)
        amount_display += f" ({default_symbol}{default_amount:.2f})"

    date_str = tx.timestamp.strftime("%Y-%m-%d %H:%M")
    
    if isinstance(tx, Expense):
        split_type = "Equally" if isinstance(tx.strategy, EqualSplitStrategy) else "Unequally"
        header = f"{date_str} | **{tx.description}** — {amount_display} | {tx.payer} ({split_type})"
    else:
        header = f"{date_str} | **{tx.description}** — {amount_display} | {tx.sender} ➔ {tx.receiver}"

    with st.expander(header):
        if isinstance(tx, Expense):
            # Read-only summary of current shares
            shares_list = ", ".join([f"{p}: {symbol}{s:.2f}" for p, s in tx.shares.items()])
            st.caption(f"👥 **Current Shares:** {shares_list}")
            st.divider()

        # Removed st.form to allow for reactive UI (showing/hiding fields based on radio selection)
        if isinstance(tx, Expense):
            col1, col2 = st.columns([3, 1])
            new_desc = col1.text_input("Description", value=tx.description, key=f"desc_{tx.id}")
            new_curr = col2.selectbox("Currency", st.session_state.group_settings['active_currencies'], 
                                    index=st.session_state.group_settings['active_currencies'].index(tx.currency),
                                    key=f"curr_{tx.id}")
            
            new_amount = st.number_input("Amount", min_value=0.0, value=float(tx.amount), step=1.0, format="%.2f", key=f"amt_{tx.id}")
            new_payer = st.selectbox("Who paid?", st.session_state.users, index=st.session_state.users.index(tx.payer) if tx.payer in st.session_state.users else 0, key=f"payer_{tx.id}")
            new_participants = st.multiselect("Who was there?", st.session_state.users, default=tx.participants, key=f"part_{tx.id}")
            
            current_split_method = "Equally" if isinstance(tx.strategy, EqualSplitStrategy) else "Unequally"
            new_split_method = st.radio("Split Method", ["Equally", "Unequally"], 
                                      index=0 if current_split_method == "Equally" else 1, 
                                      horizontal=True, key=f"split_method_{tx.id}")
            
            new_exact_amounts = {}
            if new_split_method == "Unequally" and new_participants:
                st.write("Specify amounts for each person:")
                cols = st.columns(len(new_participants))
                for i, p in enumerate(new_participants):
                    # Pre-fill with existing share for better UX
                    existing_share = tx.shares.get(p, Decimal('0'))
                    new_exact_amounts[p] = cols[i].number_input(f"{p}", min_value=0.0, value=float(existing_share), step=1.0, format="%.2f", key=f"exact_{tx.id}_{p}")
                
                current_sum = sum(new_exact_amounts.values())
                if abs(Decimal(str(current_sum)) - Decimal(str(new_amount))) > Decimal('0.001'):
                    st.warning(f"Total: {current_sum:.2f} / {new_amount:.2f} (Difference: {abs(current_sum - new_amount):.2f})")
        else:
            col1, col2 = st.columns([3, 1])
            new_desc = col1.text_input("Description", value=tx.description, key=f"desc_{tx.id}")
            new_curr = col2.selectbox("Currency", st.session_state.group_settings['active_currencies'], 
                                    index=st.session_state.group_settings['active_currencies'].index(tx.currency),
                                    key=f"curr_{tx.id}")
            
            new_amount = st.number_input("Amount", min_value=0.0, value=float(tx.amount), step=1.0, format="%.2f", key=f"amt_{tx.id}")
            col_f, col_t_user = st.columns(2)
            new_sender = col_f.selectbox("From", st.session_state.users, index=st.session_state.users.index(tx.sender) if tx.sender in st.session_state.users else 0, key=f"sender_{tx.id}")
            new_receiver = col_t_user.selectbox("To", st.session_state.users, index=st.session_state.users.index(tx.receiver) if tx.receiver in st.session_state.users else 0, key=f"receiver_{tx.id}")

        col_d, col_t = st.columns(2)
        new_date = col_d.date_input("Date", value=tx.timestamp.date(), key=f"date_{tx.id}")
        new_time = col_t.time_input("Time", value=tx.timestamp.time(), key=f"time_{tx.id}")
        
        c1, c2 = st.columns(2)
        
        # Validation for Save button
        save_disabled = False
        if isinstance(tx, Expense):
            if new_split_method == "Unequally":
                save_disabled = abs(Decimal(str(sum(new_exact_amounts.values()))) - Decimal(str(new_amount))) > Decimal('0.001')
            if not new_desc.strip() or new_amount <= 0 or not new_participants:
                save_disabled = True
        else:
            if new_amount <= 0 or new_sender == new_receiver:
                save_disabled = True

        if c1.button("💾 Save Changes", use_container_width=True, disabled=save_disabled, key=f"save_{tx.id}", type="primary"):
            if isinstance(tx, Expense):
                strategy = EqualSplitStrategy() if new_split_method == "Equally" else ExactSplitStrategy({k: Decimal(str(v)) for k, v in new_exact_amounts.items()})
                updated_tx = Expense(
                    id=tx.id,
                    payer=new_payer,
                    total_amount=Decimal(str(new_amount)),
                    participants=new_participants,
                    description=new_desc,
                    currency=new_curr,
                    strategy=strategy,
                    timestamp=datetime.combine(new_date, new_time)
                )
            else:
                updated_tx = Transfer(
                    id=tx.id,
                    sender=new_sender,
                    receiver=new_receiver,
                    amount=Decimal(str(new_amount)),
                    currency=new_curr,
                    description=new_desc,
                    timestamp=datetime.combine(new_date, new_time)
                )
            confirm_save_dialog(original_idx, updated_tx)
        
        if c2.button("🗑️ Delete", use_container_width=True, key=f"del_{tx.id}"):
            confirm_delete_dialog(original_idx, tx)

# --- Sidebar Setup ---
with st.sidebar:
    st.header("Mock Sync Tools")
    new_user = st.selectbox("Current User (Simulate device):", st.session_state.users, index=st.session_state.users.index(st.session_state.current_user))
    if new_user != st.session_state.current_user:
        st.session_state.current_user = new_user
        st.session_state.bridge.current_user_id = new_user
        st.rerun()
    if st.button("🔄 Refresh Data (Sync)", use_container_width=True):
        st.session_state.bridge.refresh()
        st.rerun()

# --- UI Header ---
st.title("💸 MoneySplitter")
st.caption("Decentralized & Private Debt Splitting")

# --- Tabs ---
tab1, tab2, tab3, tab4, tab5, tab6 = st.tabs(["📜 Transactions", "💰 Bottom Line", "🗺️ Map", "📊 Details", "💱 Rates", "⚙️ Settings"])

with tab1:
    st.subheader("Group Transactions")
    
    col_add1, col_add2 = st.columns(2)
    with col_add1:
        if st.button("➕ Add a Bill", type="primary", use_container_width=True):
            add_bill_dialog()
    with col_add2:
        if st.button("💸 Add a Transfer", use_container_width=True):
            add_transfer_dialog()

    col_group, col_sort = st.columns(2)
    with col_group:
        st.caption("Group by")
        group_by = st.radio("Group By", ["Day", "List"], horizontal=True, label_visibility="collapsed")
    with col_sort:
        st.caption("Order by")
        sort_order = st.radio("Sort Order", ["Newest", "Oldest"], horizontal=True, label_visibility="collapsed")

    transactions_with_index = list(enumerate(st.session_state.bridge.get_transactions()))
    transactions_with_index.sort(key=lambda x: x[1].timestamp, reverse=(sort_order == "Newest"))

    if not transactions_with_index:
        st.info("No transactions yet. Tap + to add your first one.")
    elif group_by == "List":
        for original_idx, tx in transactions_with_index:
            render_transaction_item(original_idx, tx)
    else:
        from itertools import groupby
        for date_key, group in groupby(transactions_with_index, key=lambda x: x[1].timestamp.date()):
            date_str = date_key.strftime("%A, %b %d")
            from datetime import timedelta
            if date_key == date.today():
                date_str = "Today"
            elif date_key == (date.today() - timedelta(days=1)):
                date_str = "Yesterday"
            
            st.markdown(f"##### {date_str}")
            for original_idx, tx in group:
                render_transaction_item(original_idx, tx)

with tab2:
    st.subheader("The Bottom Line")
    ledger = get_ledger()
    multi_balances = ledger.get_net_balances()
    
    if not multi_balances or all(not any(b.values()) for b in multi_balances.values()):
        st.info("No active balances. Add some transactions to see who owes whom!")
    else:
        # Show all currencies that have non-zero balances
        currencies_with_balances = [c for c, b in multi_balances.items() if any(abs(v) > Decimal('0.001') for v in b.values())]
        
        if not currencies_with_balances:
            st.success("Everyone is settled up! 🎉")
        else:
            for curr in currencies_with_balances:
                st.write(f"### Balances in {curr}")
                balances = multi_balances.get(curr, {})
                symbol = get_symbol(curr)
                
                for user in st.session_state.users:
                    balance = balances.get(user, Decimal('0'))
                    if balance > Decimal('0.001'):
                        st.markdown(f"**{user}**: <span class='balance-green'>is owed {symbol}{balance:.2f}</span>", unsafe_allow_html=True)
                    elif balance < Decimal('-0.001'):
                        st.markdown(f"**{user}**: <span class='balance-orange'>owes {symbol}{abs(balance):.2f}</span>", unsafe_allow_html=True)
                
                st.divider()
                st.subheader(f"Smart Settle ({curr})")
                simplified = DebtSimplifier.simplify({curr: balances}).get(curr, [])
                
                if not simplified:
                    st.write("Settled up in this currency.")
                else:
                    for tx in simplified:
                        st.markdown(f"🤝 **{tx['from']}** needs to pay **{tx['to']}** `{symbol}{tx['amount']}`")
                st.write("")

with tab3:
    st.subheader("Debt Map")
    ledger = get_ledger()
    
    # Bug fix: Show all active currencies from settings
    active_currencies = st.session_state.group_settings['active_currencies']
    selected_curr = st.selectbox("Select Currency for Map", active_currencies)
    
    exchange_rates = {curr: get_exchange_rate(curr, selected_curr) for curr in CURRENCY_SYMBOLS.keys()}
    unified_balances = ledger.get_unified_balances(selected_curr, exchange_rates)
    
    simplified = DebtSimplifier.simplify({selected_curr: unified_balances}).get(selected_curr, [])
    symbol = get_symbol(selected_curr)
    
    if not simplified:
        st.info(f"No active debts when converted to {selected_curr}.")
    else:
        if st.button("🔄 Reset View"):
            st.session_state.graph_reset_key += 1

        nodes = []
        edges = []
        users_in_debt = set()
        
        for tx in simplified:
            users_in_debt.add(tx['from'])
            users_in_debt.add(tx['to'])
            
            edges.append(Edge(
                source=tx['from'], 
                target=tx['to'], 
                label=f"{symbol}{tx['amount']}",
                color="#fd7e14" # Orange for debt flow
            ))

        for user in users_in_debt:
            balance = balances.get(user, Decimal('0'))
            color = "#28a745" if balance > 0 else "#fd7e14"
            
            nodes.append(Node(
                id=user, 
                label=user, 
                size=25, 
                color=color
            ))

        config = Config(
            width=480,
            height=400,
            directed=True,
            physics=True,
            hierarchical=False,
            fit=True
        )

        st.write(f"Showing debts in {selected_curr}. Arrows show flow of money.")
        
        with st.container(border=True):
            agraph_fixed(nodes=nodes, edges=edges, config=config, key=f"graph_{selected_curr}_{st.session_state.graph_reset_key}")

with tab4:
    st.subheader("Transaction Details")
    ledger = get_ledger()
    multi_balances = ledger.get_net_balances()
    simplified_all = DebtSimplifier.simplify(multi_balances)
    
    any_debts = False
    for curr, txs in simplified_all.items():
        if txs:
            any_debts = True
            st.write(f"### {curr} Transactions to Settle")
            df = pd.DataFrame(txs)
            symbol = get_symbol(curr)
            df['amount'] = df['amount'].apply(lambda x: f"{symbol}{x}")
            st.table(df)
    
    if not any_debts:
        st.info("No active debts.")

with tab5:
    st.subheader("💱 Exchange Rates")
    
    rates_info = st.session_state.bridge.get_exchange_rates()
    last_updated = rates_info.get("timestamp", 0)
    rates = rates_info.get("rates", {})
    
    if last_updated:
        updated_dt = datetime.fromtimestamp(last_updated)
        st.caption(f"Last updated: {updated_dt.strftime('%Y-%m-%d %H:%M:%S')} (via Frankfurter API)")
        if updated_dt.date() != date.today():
            st.warning("⚠️ The exchange rates are not from today. Check your internet connection or try updating manually.")
    else:
        st.caption("No exchange rates downloaded yet.")
        
    if rates:
        active_currencies = st.session_state.group_settings['active_currencies']
        base_curr = st.selectbox("Select Base Currency", active_currencies, index=active_currencies.index(st.session_state.group_settings['default_currency']) if st.session_state.group_settings['default_currency'] in active_currencies else 0)
        
        display_data = []
        for curr in active_currencies:
            if curr == base_curr:
                display_data.append({
                    "Currency": curr,
                    "Value": f"{get_symbol(curr)}1.0000"
                })
            else:
                # The user wants how much of `curr` makes 1 `base_curr`
                # So if base is USD ($1.0), and 1 USD = 0.85 EUR, then EUR = €0.85
                # rate = get_exchange_rate("USD", "EUR") -> 0.85
                rate = get_exchange_rate(base_curr, curr)
                display_data.append({
                    "Currency": curr,
                    "Value": f"{get_symbol(curr)}{rate:.4f}"
                })
        
        if display_data:
            st.dataframe(pd.DataFrame(display_data), use_container_width=True, hide_index=True)
            
    if st.button("🔄 Update Conversion Table", type="primary", use_container_width=True):
        update_rates_dialog()

with tab6:
    st.subheader("⚙️ Group Settings")
    
    with st.expander("👥 Members", expanded=True):
        new_user = st.text_input("Add new member")
        if st.button("Add Member"):
            if new_user and new_user not in st.session_state.users:
                st.session_state.users.append(new_user)
                st.success(f"Added {new_user}")
                st.rerun()
        
        st.write("Current members:", ", ".join(st.session_state.users))

    with st.expander("💱 Currencies", expanded=True):
        all_options = list(CURRENCY_SYMBOLS.keys())
        active = st.multiselect("Active Currencies", all_options, default=st.session_state.group_settings['active_currencies'])
        
        default = st.selectbox("Default Currency", active, 
                               index=active.index(st.session_state.group_settings['default_currency']) if st.session_state.group_settings['default_currency'] in active else 0)
        
        if st.button("Save Currency Settings"):
            st.session_state.group_settings['active_currencies'] = active
            st.session_state.group_settings['default_currency'] = default
            st.success("Settings saved!")
            st.rerun()


# Footer
st.divider()
st.caption("🔒 MoneySplitter is private. Your data never leaves your device (Syncing to Google Drive coming soon).")
