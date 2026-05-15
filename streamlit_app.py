import streamlit as st
import pandas as pd
from decimal import Decimal
from core.engine import Ledger, Expense, EqualSplitStrategy, DebtSimplifier, GroupSettings, Transfer, Transaction, ExactSplitStrategy
import uuid

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

# Mock exchange rates to USD for prototype
MOCK_RATES_TO_USD = {
    'USD': Decimal('1.0'),
    'EUR': Decimal('1.1'),
    'GBP': Decimal('1.25'),
    'ILS': Decimal('0.28'),
    'JPY': Decimal('0.0067'),
    'CAD': Decimal('0.74'),
    'AUD': Decimal('0.66'),
}

def get_exchange_rate(from_curr, to_curr):
    rate_to_usd = MOCK_RATES_TO_USD.get(from_curr, Decimal('1.0'))
    target_from_usd = Decimal('1.0') / MOCK_RATES_TO_USD.get(to_curr, Decimal('1.0'))
    return rate_to_usd * target_from_usd

def get_symbol(currency_code):
    return CURRENCY_SYMBOLS.get(currency_code, f"{currency_code} ")

def agraph_fixed(nodes, edges, config, key=None):
    nodes_data = [node.to_dict() for node in nodes]
    edges_data = [edge.to_dict() for edge in edges]
    config_json = json.dumps(config.__dict__)
    data_json = json.dumps({"nodes": nodes_data, "edges": edges_data})
    return sa._agraph(data=data_json, config=config_json, key=key)

if 'transactions' not in st.session_state:
    st.session_state.transactions = [
        Expense(id='1', payer='Ariel', total_amount=Decimal('30.00'), participants=['Ariel', 'Bob', 'Charlie'], description='Pizza', currency='USD', timestamp=datetime(2026, 5, 14, 19, 30)),
        Expense(id='2', payer='Bob', total_amount=Decimal('15.00'), participants=['Bob', 'Charlie'], description='Drinks', currency='USD', timestamp=datetime(2026, 5, 14, 21, 0))
    ]
if 'users' not in st.session_state:
    st.session_state.users = ['You', 'Ariel', 'Bob', 'Charlie', 'David']
if 'graph_reset_key' not in st.session_state:
    st.session_state.graph_reset_key = 0
if 'group_settings' not in st.session_state:
    st.session_state.group_settings = {
        'default_currency': 'USD',
        'active_currencies': ['USD', 'EUR', 'ILS']
    }

def get_ledger():
    ledger = Ledger(GroupSettings(
        default_currency=st.session_state.group_settings['default_currency'],
        active_currencies=set(st.session_state.group_settings['active_currencies'])
    ))
    for tx in st.session_state.transactions:
        ledger.add_transaction(tx)
    return ledger

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
        st.session_state.transactions.append(new_exp)
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
        st.session_state.transactions.append(new_transfer)
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
        sub_details = f"{len(tx.participants)} people"
    else:
        details = f"{tx.sender} ➔ {tx.receiver}"
        sub_details = "Direct Transfer"

    st.markdown(f"""
    <div class="bill-card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
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
        st.session_state.transactions.pop(idx)
        st.rerun()

@st.dialog("💾 Confirm Save")
def confirm_save_dialog(idx, updated_tx):
    st.write("Save changes to this transaction?")
    render_transaction_summary(updated_tx)
    if st.button("Yes, Save Changes", type="primary", use_container_width=True):
        st.session_state.transactions[idx] = updated_tx
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
        header = f"{date_str} | **{tx.description}** — {amount_display} | Paid by {tx.payer}"
    else:
        header = f"{date_str} | **{tx.description}** — {amount_display} | {tx.sender} ➔ {tx.receiver}"

    with st.expander(header):
        with st.form(key=f"edit_form_{tx.id}"):
            if isinstance(tx, Expense):
                col1, col2 = st.columns([3, 1])
                new_desc = col1.text_input("Description", value=tx.description)
                new_curr = col2.selectbox("Currency", st.session_state.group_settings['active_currencies'], 
                                        index=st.session_state.group_settings['active_currencies'].index(tx.currency),
                                        key=f"curr_{tx.id}")
                
                new_amount = st.number_input("Amount", min_value=0.0, value=float(tx.amount), step=1.0, format="%.2f", key=f"amt_{tx.id}")
                new_payer = st.selectbox("Who paid?", st.session_state.users, index=st.session_state.users.index(tx.payer) if tx.payer in st.session_state.users else 0, key=f"payer_{tx.id}")
                new_participants = st.multiselect("Who was there?", st.session_state.users, default=tx.participants, key=f"part_{tx.id}")
            else:
                col1, col2 = st.columns([3, 1])
                new_desc = col1.text_input("Description", value=tx.description)
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
            if c1.form_submit_button("💾 Save Changes", use_container_width=True):
                if isinstance(tx, Expense):
                    updated_tx = Expense(
                        id=tx.id,
                        payer=new_payer,
                        total_amount=Decimal(str(new_amount)),
                        participants=new_participants,
                        description=new_desc,
                        currency=new_curr,
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
            
            if c2.form_submit_button("🗑️ Delete", use_container_width=True):
                confirm_delete_dialog(original_idx, tx)

# --- UI Header ---
st.title("💸 MoneySplitter")
st.caption("Decentralized & Private Debt Splitting")

# --- Tabs ---
tab1, tab2, tab3, tab4, tab5 = st.tabs(["📜 Transactions", "💰 Bottom Line", "🗺️ Map", "📊 Details", "⚙️ Settings"])

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

    transactions_with_index = list(enumerate(st.session_state.transactions))
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
    multi_balances = ledger.get_net_balances()
    
    # Bug fix: Show all active currencies from settings
    active_currencies = st.session_state.group_settings['active_currencies']
    selected_curr = st.selectbox("Select Currency for Map", active_currencies)
    
    balances = multi_balances.get(selected_curr, {})
    simplified = DebtSimplifier.simplify({selected_curr: balances}).get(selected_curr, [])
    symbol = get_symbol(selected_curr)
    
    if not simplified:
        st.info(f"No active debts in {selected_curr}.")
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
