import streamlit as st
import pandas as pd
from decimal import Decimal
from core.engine import Ledger, Expense, EqualSplitStrategy, DebtSimplifier, GroupSettings
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

if 'expenses' not in st.session_state:
    st.session_state.expenses = [
        Expense(id='1', payer='Ariel', total_amount=Decimal('30.00'), participants=['Ariel', 'Bob', 'Charlie'], description='Pizza', currency='USD'),
        Expense(id='2', payer='Bob', total_amount=Decimal('15.00'), participants=['Bob', 'Charlie'], description='Drinks', currency='USD')
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
    for exp in st.session_state.expenses:
        ledger.add_expense(exp)
    return ledger

# --- UI Header ---
st.title("💸 MoneySplitter")
st.caption("Decentralized & Private Debt Splitting")

# --- Tabs ---
tab1, tab2, tab3, tab4, tab5 = st.tabs(["📜 Bills", "💰 Bottom Line", "🗺️ Map", "📊 Details", "⚙️ Settings"])

with tab1:
    st.subheader("Group Bills")
    
    # Add Bill Button
    with st.expander("➕ Add a Bill", expanded=False):
        with st.form("add_bill_form", clear_on_submit=True):
            col1, col2 = st.columns([3, 1])
            with col1:
                description = st.text_input("What was it for?", placeholder="e.g. Pizza")
            with col2:
                currency = st.selectbox("Currency", st.session_state.group_settings['active_currencies'], 
                                      index=st.session_state.group_settings['active_currencies'].index(st.session_state.group_settings['default_currency']))
            
            amount = st.number_input(f"How much?", min_value=0.01, step=0.01, format="%.2f")
            payer = st.selectbox("Who paid?", st.session_state.users)
            participants = st.multiselect("Who was there?", st.session_state.users, default=st.session_state.users)
            
            submit = st.form_submit_button("Add Bill")
            if submit:
                if not description:
                    st.error("Please enter a description")
                elif not participants:
                    st.error("At least one participant is required")
                else:
                    new_exp = Expense(
                        id=str(uuid.uuid4()),
                        payer=payer,
                        total_amount=Decimal(str(amount)),
                        participants=participants,
                        description=description,
                        currency=currency
                    )
                    st.session_state.expenses.append(new_exp)
                    st.success(f"Added '{description}'")
                    st.rerun()

    # Bills List
    for exp in reversed(st.session_state.expenses):
        symbol = get_symbol(exp.currency)
        default_curr = st.session_state.group_settings['default_currency']
        
        amount_display = f"{symbol}{exp.total_amount:.2f}"
        if exp.currency != default_curr:
            rate = get_exchange_rate(exp.currency, default_curr)
            default_amount = exp.total_amount * rate
            default_symbol = get_symbol(default_curr)
            amount_display += f" <span style='font-size: 0.8em; opacity: 0.8;'>({default_symbol}{default_amount:.2f})</span>"

        with st.container():
            st.markdown(f"""
            <div class="bill-card">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <b style="font-size: 1.1em;">{exp.description}</b><br>
                        <span style="opacity: 0.7; font-size: 0.9em;">Paid by {exp.payer}</span>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-weight: bold; font-size: 1.1em;">{amount_display}</span><br>
                        <span style="opacity: 0.6; font-size: 0.8em;">{len(exp.participants)} people</span>
                    </div>
                </div>
            </div>
            """, unsafe_allow_html=True)

with tab2:
    st.subheader("The Bottom Line")
    ledger = get_ledger()
    multi_balances = ledger.get_net_balances()
    
    if not multi_balances:
        st.info("No bills yet. Add some to see balances!")
    else:
        # If multiple currencies, let user select which one to view or show all?
        # For "The Bottom Line", showing all currencies that have non-zero balances makes sense.
        currencies_with_balances = [c for c, b in multi_balances.items() if any(v != 0 for v in b.values())]
        
        if not currencies_with_balances:
            st.success("Everyone is settled up! 🎉")
        else:
            for curr in currencies_with_balances:
                st.write(f"### Balances in {curr}")
                balances = multi_balances.get(curr, {})
                symbol = get_symbol(curr)
                
                for user in st.session_state.users:
                    balance = balances.get(user, Decimal('0'))
                    if balance > 0:
                        st.markdown(f"**{user}**: <span class='balance-green'>is owed {symbol}{balance:.2f}</span>", unsafe_allow_html=True)
                    elif balance < 0:
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
    currencies_with_debts = [c for c, b in multi_balances.items() if any(v != 0 for v in b.values())]

    if not currencies_with_debts:
        st.info("No active debts to map.")
    else:
        selected_curr = st.selectbox("Select Currency for Map", currencies_with_debts)
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
    st.subheader("Debt Details")
    ledger = get_ledger()
    multi_balances = ledger.get_net_balances()
    simplified_all = DebtSimplifier.simplify(multi_balances)
    
    any_debts = False
    for curr, txs in simplified_all.items():
        if txs:
            any_debts = True
            st.write(f"### {curr} Transactions")
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
