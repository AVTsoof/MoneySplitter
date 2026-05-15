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

def get_ledger():
    ledger = Ledger(GroupSettings(default_currency='USD'))
    for exp in st.session_state.expenses:
        ledger.add_expense(exp)
    return ledger

# --- UI Header ---
st.title("💸 MoneySplitter")
st.caption("Decentralized & Private Debt Splitting")

# --- Tabs ---
tab1, tab2, tab3, tab4 = st.tabs(["📜 Bills", "💰 Bottom Line", "🗺️ Map", "📊 Details"])

with tab1:
    st.subheader("Group Bills")
    
    # Add Bill Button
    with st.expander("➕ Add a Bill", expanded=False):
        with st.form("add_bill_form", clear_on_submit=True):
            description = st.text_input("What was it for?", placeholder="e.g. Pizza")
            amount = st.number_input("How much?", min_value=0.01, step=0.01, format="%.2f")
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
                        currency='USD'
                    )
                    st.session_state.expenses.append(new_exp)
                    st.success(f"Added '{description}'")
                    st.rerun()

    # Bills List
    for exp in reversed(st.session_state.expenses):
        with st.container():
            st.markdown(f"""
            <div class="bill-card">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <b style="font-size: 1.1em;">{exp.description}</b><br>
                        <span style="opacity: 0.7; font-size: 0.9em;">Paid by {exp.payer}</span>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-weight: bold; font-size: 1.1em;">${exp.total_amount:.2f}</span><br>
                        <span style="opacity: 0.6; font-size: 0.8em;">{len(exp.participants)} people</span>
                    </div>
                </div>
            </div>
            """, unsafe_allow_html=True)

with tab2:
    st.subheader("The Bottom Line")
    ledger = get_ledger()
    balances = ledger.get_net_balances().get('USD', {})
    
    if not balances:
        st.info("No bills yet. Add some to see balances!")
    else:
        # Display individual balances
        for user in st.session_state.users:
            balance = balances.get(user, Decimal('0'))
            if balance > 0:
                st.markdown(f"**{user}**: <span class='balance-green'>is owed ${balance:.2f}</span>", unsafe_allow_html=True)
            elif balance < 0:
                st.markdown(f"**{user}**: <span class='balance-orange'>owes ${abs(balance):.2f}</span>", unsafe_allow_html=True)
            else:
                st.markdown(f"**{user}**: <span class='balance-neutral'>is settled up</span>", unsafe_allow_html=True)
        
        st.divider()
        st.subheader("Smart Settle")
        simplified = DebtSimplifier.simplify({'USD': balances}).get('USD', [])
        
        if not simplified:
            st.success("Everyone is settled up! 🎉")
        else:
            for tx in simplified:
                st.markdown(f"🤝 **{tx['from']}** needs to pay **{tx['to']}** `${tx['amount']}`")

with tab3:
    st.subheader("Debt Map")
    ledger = get_ledger()
    balances = ledger.get_net_balances().get('USD', {})
    simplified = DebtSimplifier.simplify({'USD': balances}).get('USD', [])
    
    if not simplified:
        st.info("No active debts to map.")
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
                label=f"${tx['amount']}",
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

        st.write("Arrows show who needs to pay who. Green is receiving, Orange is paying.")
        
        with st.container(border=True):
            agraph_fixed(nodes=nodes, edges=edges, config=config, key=f"graph_{st.session_state.graph_reset_key}")

with tab4:
    st.subheader("Debt Details")
    ledger = get_ledger()
    balances = ledger.get_net_balances().get('USD', {})
    simplified = DebtSimplifier.simplify({'USD': balances}).get('USD', [])
    
    if not simplified:
        st.info("No active debts.")
    else:
        st.table(pd.DataFrame(simplified))


# Footer
st.divider()
st.caption("🔒 MoneySplitter is private. Your data never leaves your device (Syncing to Google Drive coming soon).")
