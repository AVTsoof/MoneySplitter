import streamlit as st
import pandas as pd
from decimal import Decimal
from itertools import groupby
from datetime import datetime, date, timedelta
import uuid
import json
from streamlit_agraph import Node, Edge, Config
import streamlit_agraph as sa

from core.engine import Ledger, Expense, EqualSplitStrategy, DebtSimplifier, GroupSettings, Transfer, ExactSplitStrategy, CurrencyConverter, UserSession
from core.types import SplitMethod
from core.constants import CURRENCY_SYMBOLS, get_currency_symbol
from io_layer.local_fs import LocalFileSystemIO, LocalFSAuthProvider
from bridge.orchestrator import Bridge
from config.app_config import load_config, save_config, get_default_data_dir

# --- Constants & Enums for UI ---
class UITabNames:
    TRANSACTIONS = "📜 Transactions"
    DETAILS = "📊 Details"
    MAP = "🗺️ Map"
    RATES = "💱 Rates"
    SETTINGS = "⚙️ Settings"

class UISortOrder:
    NEWEST = "Newest"
    OLDEST = "Oldest"

class UIGroupBy:
    DAY = "Day"
    LIST = "List"

class UIStateKeys:
    GRAPH_RESET = "graph_reset_key"
    REPO = "repo"
    USER_SESSION = "user_session"
    AUTH_PROVIDER = "auth_provider"
    BRIDGE = "bridge"
    CURRENT_USER = "current_user"

# --- Setup & Configuration ---
def setup_page_config():
    st.set_page_config(
        page_title="MoneySplitter",
        page_icon="💸",
        layout="centered",
        initial_sidebar_state="collapsed"
    )

def apply_custom_css():
    st.markdown("""
    <style>
        .stApp { max-width: 500px; margin: 0 auto; }
        .stButton>button { width: 100%; border-radius: 12px; height: 3em; font-weight: bold; }
        .bill-card { padding: 15px; border-radius: 15px; margin-bottom: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); border: 1px solid rgba(128, 128, 128, 0.3); }
        .balance-green { color: #28a745; font-weight: bold; }
        .balance-orange { color: #fd7e14; font-weight: bold; }
        .balance-neutral { color: #6c757d; }
    </style>
    """, unsafe_allow_html=True)

def initialize_session_state():
    if UIStateKeys.GRAPH_RESET not in st.session_state:
        st.session_state[UIStateKeys.GRAPH_RESET] = 0
    if UIStateKeys.REPO not in st.session_state:
        _app_cfg = load_config()
        _data_dir = _app_cfg.get("data_dir", get_default_data_dir())
        st.session_state[UIStateKeys.REPO] = LocalFileSystemIO(_data_dir)
    if UIStateKeys.USER_SESSION not in st.session_state:
        st.session_state[UIStateKeys.USER_SESSION] = UserSession()
    if UIStateKeys.AUTH_PROVIDER not in st.session_state:
        st.session_state[UIStateKeys.AUTH_PROVIDER] = LocalFSAuthProvider(st.session_state[UIStateKeys.REPO])

# --- UI Helper Functions ---
def get_exchange_rate(from_curr, to_curr):
    if UIStateKeys.BRIDGE not in st.session_state:
        return Decimal('1.0')
    rates_data = st.session_state.bridge.get_exchange_rates().get("rates", {})
    return CurrencyConverter.get_exchange_rate(rates_data, from_curr, to_curr)

def render_currency_selector(label, key):
    active_currencies = list(st.session_state.bridge.settings.active_currencies)
    default_curr = st.session_state.bridge.settings.default_currency
    idx = active_currencies.index(default_curr) if default_curr in active_currencies else 0
    return st.selectbox(label, active_currencies, index=idx, key=key)

def render_agraph_component(nodes, edges, config, key=None):
    nodes_data = [node.to_dict() for node in nodes]
    edges_data = [edge.to_dict() for edge in edges]
    config_json = json.dumps(config.__dict__)
    data_json = json.dumps({"nodes": nodes_data, "edges": edges_data})
    return sa._agraph(data=data_json, config=config_json, key=key)

# --- Dialogs ---
class DialogManager:
    @staticmethod
    @st.dialog("Create New Group")
    def create_group():
        session = st.session_state[UIStateKeys.USER_SESSION]
        repo = st.session_state[UIStateKeys.REPO]

        st.write("Enter details for your new group:")
        group_name = st.text_input("Group Name (Folder Name)")
        default_members = session.logged_in_user
        member_names = st.text_input("Members (comma separated)", value=default_members, placeholder="Alice, Bob, Charlie")
        default_currency = st.selectbox("Default Currency", list(CURRENCY_SYMBOLS.keys()), index=0)

        if st.button("Create", type="primary"):
            if group_name and member_names:
                members_list = [m.strip() for m in member_names.split(",") if m.strip()]
                settings = GroupSettings(default_currency=default_currency, active_currencies={default_currency}, members=members_list)
                repo.save_group_settings(group_name, settings.to_dict())
                
                current_user = session.resolve_current_user(members_list)
                session.select_group(group_name)
                
                st.session_state[UIStateKeys.BRIDGE] = Bridge(repo, current_user_id=current_user, group_id=group_name)
                st.session_state[UIStateKeys.CURRENT_USER] = current_user
                st.rerun()
            else:
                st.error("Please provide a valid group name and at least one member.")

    @staticmethod
    @st.dialog("➕ Add a Bill")
    def add_bill():
        bridge = st.session_state.bridge
        members = bridge.settings.members
        active_currs = list(bridge.settings.active_currencies)
        default_curr = bridge.settings.default_currency
        curr_idx = active_currs.index(default_curr) if default_curr in active_currs else 0

        col1, col2 = st.columns([3, 1])
        with col1:
            description = st.text_input("What was it for? :red[*]", placeholder="e.g. Pizza")
        with col2:
            currency = st.selectbox("Currency", active_currs, index=curr_idx)
        
        amount = st.number_input("How much? :red[*]", min_value=0.0, value=0.0, step=1.0, format="%.2f")
        payer = st.selectbox("Who paid?", members)
        participants = st.multiselect("Who was there? :red[*]", members, default=members)
        
        split_method = st.radio("Split Method", [SplitMethod.EQUALLY.value, SplitMethod.UNEQUALLY.value], horizontal=True)
        
        exact_amounts = {}
        if split_method == SplitMethod.UNEQUALLY.value and participants:
            st.write("Specify amounts for each person:")
            cols = st.columns(len(participants))
            for i, p in enumerate(participants):
                exact_amounts[p] = cols[i].number_input(f"{p}", min_value=0.0, value=0.0, step=1.0, format="%.2f", key=f"exact_{p}")
            
            current_sum = sum(exact_amounts.values())
            if abs(Decimal(str(current_sum)) - Decimal(str(amount))) > Decimal('0.001'):
                st.warning(f"Total: {current_sum:.2f} / {amount:.2f} (Difference: {abs(current_sum - amount):.2f})")
        elif split_method == SplitMethod.EQUALLY.value and participants and amount > 0:
            share = Decimal(str(amount)) / len(participants)
            st.caption(f"💡 Each person will pay: {get_currency_symbol(currency)}{share:.2f}")
        
        col_d, col_t = st.columns(2)
        with col_d:
            bill_date = st.date_input("Date", value=date.today())
        with col_t:
            bill_time = st.time_input("Time", value=datetime.now().time())
        
        is_valid = description.strip() != "" and amount > 0 and len(participants) > 0
        if split_method == SplitMethod.UNEQUALLY.value:
            is_valid = is_valid and abs(Decimal(str(sum(exact_amounts.values()))) - Decimal(str(amount))) < Decimal('0.001')
        
        if st.button("Add Bill", width='stretch', type="primary", disabled=not is_valid):
            full_timestamp = datetime.combine(bill_date, bill_time)
            strategy = EqualSplitStrategy() if split_method == SplitMethod.EQUALLY.value else ExactSplitStrategy({k: Decimal(str(v)) for k, v in exact_amounts.items()})
            
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
            bridge.add_transaction(new_exp)
            st.rerun()
        
        if not is_valid:
            if split_method == SplitMethod.UNEQUALLY.value and amount > 0 and participants:
                 st.caption("⚠️ The sum of individual amounts must equal the total amount.")
            else:
                 st.caption("⚠️ Please provide a description and amount to enable the button.")

    @staticmethod
    @st.dialog("💸 Add a Transfer")
    def add_transfer():
        bridge = st.session_state.bridge
        members = bridge.settings.members
        active_currs = list(bridge.settings.active_currencies)
        default_curr = bridge.settings.default_currency
        curr_idx = active_currs.index(default_curr) if default_curr in active_currs else 0

        col1, col2 = st.columns([3, 1])
        with col1:
            description = st.text_input("Description", value="Transfer", placeholder="e.g. Payback")
        with col2:
            currency = st.selectbox("Currency", active_currs, index=curr_idx)
        
        amount = st.number_input("How much?", min_value=0.0, value=0.0, step=1.0, format="%.2f")
        col_f, col_t_user = st.columns(2)
        with col_f:
            sender = st.selectbox("From", members)
        with col_t_user:
            receiver = st.selectbox("To", members, index=1 if len(members) > 1 else 0)
        
        col_d, col_t = st.columns(2)
        with col_d:
            transfer_date = st.date_input("Date", value=date.today())
        with col_t:
            transfer_time = st.time_input("Time", value=datetime.now().time())
        
        is_valid = amount > 0 and sender != receiver
        
        if st.button("Add Transfer", width='stretch', type="primary", disabled=not is_valid):
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
            bridge.add_transaction(new_transfer)
            st.rerun()
        
        if sender == receiver:
            st.caption("⚠️ Sender and Receiver must be different.")
        elif amount <= 0:
            st.caption("⚠️ Amount must be greater than 0.")

    @staticmethod
    @st.dialog("🗑️ Confirm Delete")
    def confirm_delete(idx, tx):
        st.warning("Are you sure you want to delete this transaction?")
        UIComponents.render_transaction_summary(tx)
        st.write("This action cannot be undone.")
        if st.button("Yes, Delete", type="primary", width='stretch'):
            st.session_state.bridge.delete_transaction(tx.id)
            st.toast("Transaction deleted.")
            st.rerun()

    @staticmethod
    @st.dialog("💾 Confirm Save")
    def confirm_save(idx, updated_tx):
        st.write("Save changes to this transaction?")
        UIComponents.render_transaction_summary(updated_tx)
        if st.button("Yes, Save Changes", type="primary", width='stretch'):
            updated = st.session_state.bridge.update_transaction(updated_tx)
            if updated:
                st.toast("Changes saved!")
            else:
                st.toast("⚠️ Could not find the original transaction to update.", icon="⚠️")
            st.rerun()

    @staticmethod
    @st.dialog("🗑️ Delete Group")
    def delete_group():
        bridge = st.session_state.bridge
        repo = st.session_state.repo
        group_id = bridge.group_id
        display_name = getattr(bridge.settings, 'name', None) or group_id
        
        st.error(f"You are about to **permanently delete** the group **\"{display_name}\"** and all its data.")
        st.warning("⚠️ This action **cannot be undone**. All transactions and settings will be lost forever.")
        st.write("To confirm, type the group name below:")
        confirm_input = st.text_input("Group name", placeholder=display_name, key="delete_group_confirm_input")
        
        is_confirmed = confirm_input.strip() == display_name
        if st.button("🗑️ Permanently Delete", type="primary", width='stretch', disabled=not is_confirmed):
            repo.delete_group(group_id)
            bridge.group_id = None
            del st.session_state[UIStateKeys.BRIDGE]
            st.toast(f"Group \"{display_name}\" deleted.", icon="🗑️")
            st.rerun()
        if not is_confirmed and confirm_input:
            st.caption("⚠️ The name does not match. Please type it exactly as shown.")

    @staticmethod
    @st.dialog("🔄 Updating Conversion Table")
    def update_rates():
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
            if st.button("Close", width='stretch'):
                st.rerun()

# --- UI Components ---
class UIComponents:
    @staticmethod
    def render_transaction_summary(tx):
        symbol = get_currency_symbol(tx.currency)
        default_curr = st.session_state.bridge.settings.default_currency
        amount_display = f"{symbol}{tx.amount:.2f}"
        
        if tx.currency != default_curr:
            rate = get_exchange_rate(tx.currency, default_curr)
            default_amount = tx.amount * rate
            default_symbol = get_currency_symbol(default_curr)
            amount_display += f" ({default_symbol}{default_amount:.2f})"
        
        date_str = tx.timestamp.strftime("%Y-%m-%d %H:%M")
        
        if isinstance(tx, Expense):
            details = f"Paid by {tx.payer}"
            split_type = SplitMethod.EQUALLY.value if isinstance(tx.strategy, EqualSplitStrategy) else SplitMethod.UNEQUALLY.value
            sub_details = f"{len(tx.participants)} people • Split {split_type}"
            
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

    @staticmethod
    def render_transaction_item(original_idx, tx):
        bridge = st.session_state.bridge
        symbol = get_currency_symbol(tx.currency)
        default_curr = bridge.settings.default_currency
        members = bridge.settings.members
        active_currs = list(bridge.settings.active_currencies)
        
        amount_display = f"{symbol}{tx.amount:.2f}"
        if tx.currency != default_curr:
            rate = get_exchange_rate(tx.currency, default_curr)
            default_amount = tx.amount * rate
            default_symbol = get_currency_symbol(default_curr)
            amount_display += f" ({default_symbol}{default_amount:.2f})"

        date_str = tx.timestamp.strftime("%Y-%m-%d %H:%M")
        
        if isinstance(tx, Expense):
            split_type = SplitMethod.EQUALLY.value if isinstance(tx.strategy, EqualSplitStrategy) else SplitMethod.UNEQUALLY.value
            header = f"{date_str} | **{tx.description}** — {amount_display} | {tx.payer} ({split_type})"
        else:
            header = f"{date_str} | **{tx.description}** — {amount_display} | {tx.sender} ➔ {tx.receiver}"

        with st.expander(header):
            if isinstance(tx, Expense):
                shares_list = ", ".join([f"{p}: {symbol}{s:.2f}" for p, s in tx.shares.items()])
                st.caption(f"👥 **Current Shares:** {shares_list}")
                st.divider()

            if isinstance(tx, Expense):
                col1, col2 = st.columns([3, 1])
                new_desc = col1.text_input("Description", value=tx.description, key=f"desc_{tx.id}")
                new_curr = col2.selectbox("Currency", active_currs, index=active_currs.index(tx.currency), key=f"curr_{tx.id}")
                
                new_amount = st.number_input("Amount", min_value=0.0, value=float(tx.amount), step=1.0, format="%.2f", key=f"amt_{tx.id}")
                new_payer = st.selectbox("Who paid?", members, index=members.index(tx.payer) if tx.payer in members else 0, key=f"payer_{tx.id}")
                new_participants = st.multiselect("Who was there?", members, default=tx.participants, key=f"part_{tx.id}")
                
                current_split_method = SplitMethod.EQUALLY.value if isinstance(tx.strategy, EqualSplitStrategy) else SplitMethod.UNEQUALLY.value
                new_split_method = st.radio("Split Method", [SplitMethod.EQUALLY.value, SplitMethod.UNEQUALLY.value], 
                                          index=0 if current_split_method == SplitMethod.EQUALLY.value else 1, 
                                          horizontal=True, key=f"split_{tx.id}")
                
                new_exact_amounts = {}
                if new_split_method == SplitMethod.UNEQUALLY.value and new_participants:
                    st.write("Specify amounts for each person:")
                    cols = st.columns(len(new_participants))
                    for i, p in enumerate(new_participants):
                        existing_share = tx.shares.get(p, Decimal('0'))
                        new_exact_amounts[p] = cols[i].number_input(f"{p}", min_value=0.0, value=float(existing_share), step=1.0, format="%.2f", key=f"ex_{tx.id}_{p}")
                    
                    current_sum = sum(new_exact_amounts.values())
                    if abs(Decimal(str(current_sum)) - Decimal(str(new_amount))) > Decimal('0.001'):
                        st.warning(f"Total: {current_sum:.2f} / {new_amount:.2f} (Difference: {abs(current_sum - new_amount):.2f})")
            else:
                col1, col2 = st.columns([3, 1])
                new_desc = col1.text_input("Description", value=tx.description, key=f"desc_{tx.id}")
                new_curr = col2.selectbox("Currency", active_currs, index=active_currs.index(tx.currency), key=f"curr_{tx.id}")
                
                new_amount = st.number_input("Amount", min_value=0.0, value=float(tx.amount), step=1.0, format="%.2f", key=f"amt_{tx.id}")
                col_f, col_t_user = st.columns(2)
                new_sender = col_f.selectbox("From", members, index=members.index(tx.sender) if tx.sender in members else 0, key=f"sender_{tx.id}")
                new_receiver = col_t_user.selectbox("To", members, index=members.index(tx.receiver) if tx.receiver in members else 0, key=f"receiver_{tx.id}")

            col_d, col_t = st.columns(2)
            new_date = col_d.date_input("Date", value=tx.timestamp.date(), key=f"date_{tx.id}")
            new_time = col_t.time_input("Time", value=tx.timestamp.time(), key=f"time_{tx.id}")
            
            c1, c2 = st.columns(2)
            
            save_disabled = False
            if isinstance(tx, Expense):
                if new_split_method == SplitMethod.UNEQUALLY.value:
                    save_disabled = abs(Decimal(str(sum(new_exact_amounts.values()))) - Decimal(str(new_amount))) > Decimal('0.001')
                if not new_desc.strip() or new_amount <= 0 or not new_participants:
                    save_disabled = True
            else:
                if new_amount <= 0 or new_sender == new_receiver:
                    save_disabled = True

            if c1.button("💾 Save Changes", width='stretch', disabled=save_disabled, key=f"save_{tx.id}", type="primary"):
                dt_combined = datetime.combine(new_date, new_time)
                if isinstance(tx, Expense):
                    strategy = EqualSplitStrategy() if new_split_method == SplitMethod.EQUALLY.value else ExactSplitStrategy({k: Decimal(str(v)) for k, v in new_exact_amounts.items()})
                    updated_tx = Expense(
                        id=tx.id, payer=new_payer, total_amount=Decimal(str(new_amount)),
                        participants=new_participants, description=new_desc, currency=new_curr,
                        strategy=strategy, timestamp=dt_combined
                    )
                else:
                    updated_tx = Transfer(
                        id=tx.id, sender=new_sender, receiver=new_receiver,
                        amount=Decimal(str(new_amount)), currency=new_curr,
                        description=new_desc, timestamp=dt_combined
                    )
                DialogManager.confirm_save(original_idx, updated_tx)
            
            if c2.button("🗑️ Delete", width='stretch', key=f"del_{tx.id}"):
                DialogManager.confirm_delete(original_idx, tx)

# --- Tab Views ---
class MainAppTabs:
    @staticmethod
    def render_transactions_tab():
        st.subheader("Group Transactions")
        col_add1, col_add2 = st.columns(2)
        with col_add1:
            if st.button("➕ Add a Bill", type="primary", width='stretch'): DialogManager.add_bill()
        with col_add2:
            if st.button("💸 Add a Transfer", width='stretch'): DialogManager.add_transfer()

        col_group, col_sort = st.columns(2)
        with col_group:
            st.caption("Group by")
            group_by = st.radio("Group By", [UIGroupBy.DAY, UIGroupBy.LIST], horizontal=True, label_visibility="collapsed")
        with col_sort:
            st.caption("Order by")
            sort_order = st.radio("Sort Order", [UISortOrder.NEWEST, UISortOrder.OLDEST], horizontal=True, label_visibility="collapsed")

        transactions_with_index = list(enumerate(st.session_state.bridge.get_transactions()))
        transactions_with_index.sort(key=lambda x: x[1].timestamp, reverse=(sort_order == UISortOrder.NEWEST))

        if not transactions_with_index:
            st.info("No transactions yet. Tap + to add your first one.")
        elif group_by == UIGroupBy.LIST:
            for original_idx, tx in transactions_with_index:
                UIComponents.render_transaction_item(original_idx, tx)
        else:
            for date_key, group in groupby(transactions_with_index, key=lambda x: x[1].timestamp.date()):
                date_str = date_key.strftime("%A, %b %d")
                if date_key == date.today():
                    date_str = "Today"
                elif date_key == (date.today() - timedelta(days=1)):
                    date_str = "Yesterday"
                
                st.markdown(f"##### {date_str}")
                for original_idx, tx in group:
                    UIComponents.render_transaction_item(original_idx, tx)

    @staticmethod
    def render_details_tab():
        st.subheader("📊 Details")
        ledger = st.session_state.bridge.ledger
        
        selected_curr = render_currency_selector("Select Settlement Currency", key="details_curr")
        exchange_rates = {curr: get_exchange_rate(curr, selected_curr) for curr in CURRENCY_SYMBOLS.keys()}
        unified_balances = ledger.get_unified_balances(selected_curr, exchange_rates)
        
        if not unified_balances or not any(abs(v) > Decimal('0.001') for v in unified_balances.values()):
            st.success("Everyone is settled up! 🎉")
        else:
            st.write(f"### Balances in {selected_curr}")
            symbol = get_currency_symbol(selected_curr)
            for user in st.session_state.bridge.settings.members:
                balance = unified_balances.get(user, Decimal('0'))
                if balance > Decimal('0.001'):
                    st.markdown(f"**{user}**: <span class='balance-green'>is owed {symbol}{balance:.2f}</span>", unsafe_allow_html=True)
                elif balance < Decimal('-0.001'):
                    st.markdown(f"**{user}**: <span class='balance-orange'>owes {symbol}{abs(balance):.2f}</span>", unsafe_allow_html=True)
            
            st.divider()
            st.write(f"### Transactions to Settle ({selected_curr})")
            simplified = DebtSimplifier.simplify({selected_curr: unified_balances}).get(selected_curr, [])
            
            if not simplified:
                st.info("No active debts.")
            else:
                df = pd.DataFrame(simplified)
                df['amount'] = df['amount'].apply(lambda x: f"{symbol}{x}")
                st.table(df)

    @staticmethod
    def render_map_tab():
        st.subheader("Debt Map")
        ledger = st.session_state.bridge.ledger
        
        selected_curr = render_currency_selector("Select Currency for Map", key="map_curr")
        exchange_rates = {curr: get_exchange_rate(curr, selected_curr) for curr in CURRENCY_SYMBOLS.keys()}
        unified_balances = ledger.get_unified_balances(selected_curr, exchange_rates)
        
        simplified = DebtSimplifier.simplify({selected_curr: unified_balances}).get(selected_curr, [])
        symbol = get_currency_symbol(selected_curr)
        
        if not simplified:
            st.info(f"No active debts when converted to {selected_curr}.")
        else:
            if st.button("🔄 Reset View"):
                st.session_state[UIStateKeys.GRAPH_RESET] += 1

            nodes, edges = [], []
            users_in_debt = set()
            
            for tx in simplified:
                users_in_debt.add(tx['from'])
                users_in_debt.add(tx['to'])
                edges.append(Edge(source=tx['from'], target=tx['to'], label=f"{symbol}{tx['amount']}", color="#fd7e14"))

            for user in users_in_debt:
                balance = unified_balances.get(user, Decimal('0'))
                color = "#28a745" if balance > 0 else "#fd7e14"
                nodes.append(Node(id=user, label=user, size=25, color=color))

            config = Config(width=480, height=400, directed=True, physics=True, hierarchical=False, fit=True)
            st.write(f"Showing debts in {selected_curr}. Arrows show flow of money.")
            
            with st.container(border=True):
                render_agraph_component(nodes, edges, config, key=f"graph_{selected_curr}_{st.session_state[UIStateKeys.GRAPH_RESET]}")

    @staticmethod
    def render_rates_tab():
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
            base_curr = render_currency_selector("Select Base Currency", key="rates_curr")
            active_currencies = list(st.session_state.bridge.settings.active_currencies)
            
            display_data = []
            for curr in active_currencies:
                if curr == base_curr:
                    display_data.append({"Currency": curr, "Value": f"{get_currency_symbol(curr)}1.0000"})
                else:
                    rate = get_exchange_rate(base_curr, curr)
                    display_data.append({"Currency": curr, "Value": f"{get_currency_symbol(curr)}{rate:.4f}"})
            
            if display_data:
                st.dataframe(pd.DataFrame(display_data), width='stretch', hide_index=True)
                
        if st.button("🔄 Update Conversion Table", type="primary", width='stretch'):
            DialogManager.update_rates()

    @staticmethod
    def render_settings_tab():
        st.subheader("⚙️ Group Settings")
        bridge = st.session_state.bridge
        repo = st.session_state.repo
        
        with st.expander("👥 Members", expanded=False):
            new_user = st.text_input("Add new member")
            if st.button("Add Member"):
                if new_user and new_user not in bridge.settings.members:
                    bridge.settings.members.append(new_user)
                    bridge.save_settings()
                    st.success(f"Added {new_user}")
                    st.rerun()
            st.write("Current members:", ", ".join(bridge.settings.members))

        with st.expander("💱 Currencies", expanded=False):
            all_options = list(CURRENCY_SYMBOLS.keys())
            active = st.multiselect("Active Currencies", all_options, default=list(bridge.settings.active_currencies))
            idx = active.index(bridge.settings.default_currency) if bridge.settings.default_currency in active else 0
            default = st.selectbox("Default Currency", active, index=idx)
            
            if st.button("Save Currency Settings"):
                bridge.settings.active_currencies = set(active)
                bridge.settings.default_currency = default
                bridge.save_settings()
                st.success("Settings saved!")
                st.rerun()

        with st.expander("📂 Data Storage"):
            current_data_dir = repo.base_dir
            default_data_dir = get_default_data_dir()

            st.caption("Current data directory:")
            st.code(current_data_dir, language=None)
            st.info("⚠️ Changing the data directory will **not** migrate existing data. The app will simply look for groups in the new location.")

            new_path = st.text_input("Set new data directory", value=current_data_dir, placeholder=default_data_dir, key="settings_data_dir_input")

            col_apply, col_reset = st.columns(2)
            with col_apply:
                if st.button("✅ Apply", width='stretch', type="primary", disabled=(new_path.strip() == current_data_dir)):
                    _cfg = load_config()
                    _cfg["data_dir"] = new_path.strip()
                    save_config(_cfg)
                    st.session_state[UIStateKeys.REPO] = LocalFileSystemIO(new_path.strip())
                    if UIStateKeys.BRIDGE in st.session_state:
                        del st.session_state[UIStateKeys.BRIDGE]
                    st.toast("Data directory updated. Please select a group.", icon="📂")
                    st.rerun()
            with col_reset:
                if st.button("↩️ Reset to Default", width='stretch', disabled=(current_data_dir == default_data_dir)):
                    _cfg = load_config()
                    _cfg["data_dir"] = default_data_dir
                    save_config(_cfg)
                    st.session_state[UIStateKeys.REPO] = LocalFileSystemIO(default_data_dir)
                    if UIStateKeys.BRIDGE in st.session_state:
                        del st.session_state[UIStateKeys.BRIDGE]
                    st.toast("Data directory reset to default.", icon="↩️")
                    st.rerun()

        with st.expander("🚨 Danger Zone"):
            st.write("Permanently delete this group and all its data. This cannot be undone.")
            if st.button("🗑️ Delete This Group", type="primary", width='stretch'):
                DialogManager.delete_group()

# --- Main App Views ---
class MainApplication:
    def __init__(self):
        setup_page_config()
        apply_custom_css()
        initialize_session_state()
        self.session: UserSession = st.session_state[UIStateKeys.USER_SESSION]
        self.auth: LocalFSAuthProvider = st.session_state[UIStateKeys.AUTH_PROVIDER]
        self.repo = st.session_state[UIStateKeys.REPO]

    def render_login(self):
        st.title("Welcome to MoneySplitter 💸")
        st.markdown("##### Who are you?")
        st.write("Select your name to continue, or type a new name if this is your first time.")

        known = self.auth.get_known_members()
        chosen = st.selectbox("Select your name", ["— type a new name —"] + known) if known else "— type a new name —"

        if chosen == "— type a new name —":
            manual = st.text_input("Your name", placeholder="e.g. Alice")
            login_name = manual.strip()
        else:
            login_name = chosen

        if st.button("Continue ➜", type="primary", disabled=not login_name):
            self.session.login(login_name)
            st.rerun()

    def render_group_selection(self):
        logged_user = self.session.logged_in_user
        st.title("Welcome to MoneySplitter 💸")
        st.markdown(f"👋 Hello, **{logged_user}**! Select or create a group to continue.")

        available_groups = self.repo.list_groups()
        group_labels = {gid: (self.repo.get_group_settings(gid) or {}).get("name", gid) for gid in available_groups}

        col1, col2, col3 = st.columns(3)

        with col1:
            st.subheader("Open Group")
            if available_groups:
                label_to_id = {v: k for k, v in group_labels.items()}
                selected_label = st.selectbox("Select existing group", list(group_labels.values()))
                selected_group = label_to_id[selected_label]
                if st.button("Open", type="primary"):
                    temp_settings = self.repo.get_group_settings(selected_group)
                    members = temp_settings.get("members", [])
                    current_user = self.session.resolve_current_user(members)
                    self.session.select_group(selected_group)
                    st.session_state[UIStateKeys.BRIDGE] = Bridge(self.repo, current_user_id=current_user, group_id=selected_group)
                    st.session_state[UIStateKeys.CURRENT_USER] = current_user
                    st.rerun()
            else:
                st.info("No groups found.")

        with col2:
            st.subheader("New Group")
            if st.button("➕ Create New Group"):
                DialogManager.create_group()

        with col3:
            st.subheader("Examples")
            if st.button("📖 Load Example Group"):
                self.repo.load_example_group()
                st.toast("Example group loaded! You can now select it on the left.")
                st.rerun()

        st.divider()
        if st.button("← Log Out", width='content'):
            self.session.logout()
            st.rerun()

    def render_sidebar(self):
        with st.sidebar:
            st.markdown(f"### 👤 {self.session.logged_in_user}")
            _group_display = getattr(st.session_state.bridge.settings, 'name', None) or st.session_state.bridge.group_id
            st.caption(f"📁 {_group_display}")
            st.divider()

            if st.button("🔄 Change Group", width='stretch'):
                self.session.switch_group()
                if UIStateKeys.BRIDGE in st.session_state:
                    del st.session_state[UIStateKeys.BRIDGE]
                st.rerun()

            if st.button("🚪 Log Out", width='stretch'):
                self.session.logout()
                if UIStateKeys.BRIDGE in st.session_state:
                    del st.session_state[UIStateKeys.BRIDGE]
                st.rerun()

    def render_main(self):
        if UIStateKeys.CURRENT_USER not in st.session_state:
            st.session_state[UIStateKeys.CURRENT_USER] = self.session.logged_in_user or st.session_state.bridge.current_user_id

        self.render_sidebar()

        st.title("💸 MoneySplitter")
        _group_display_name = getattr(st.session_state.bridge.settings, 'name', None) or st.session_state.bridge.group_id
        st.caption(f"📁 {_group_display_name} · Decentralized & Private Debt Splitting")

        tabs = st.tabs([UITabNames.TRANSACTIONS, UITabNames.DETAILS, UITabNames.MAP, UITabNames.RATES, UITabNames.SETTINGS])
        
        with tabs[0]: MainAppTabs.render_transactions_tab()
        with tabs[1]: MainAppTabs.render_details_tab()
        with tabs[2]: MainAppTabs.render_map_tab()
        with tabs[3]: MainAppTabs.render_rates_tab()
        with tabs[4]: MainAppTabs.render_settings_tab()

        st.divider()
        st.caption("🔒 MoneySplitter is private. Your data never leaves your device (Syncing to Google Drive coming soon).")

    def run(self):
        if not self.session.is_logged_in:
            self.render_login()
            return
            
        if not self.session.has_group or UIStateKeys.BRIDGE not in st.session_state:
            self.render_group_selection()
            return
            
        self.render_main()

# --- Entry Point ---
if __name__ == "__main__":
    app = MainApplication()
    app.run()
