# TODO

- core+app(streamlit): everything is a transaction (bill/transfer/etc.).
  - core module should support transfering between users.
    - implement tests for it
  - create a base class which is Transaction that other would inherit from, sharing common fields such as timestamp, currency and amount.
  - the UI should show a list of transactions.
- app: add an option to add a transfer between users alongside the button to add bill.
- app: fix: "bottom line" tab in streamlit app is not updated when adding bills or transactions
- app: Dept map "Select Currency for Map" does no show all currency options from the settings.
- core+app: in bill options there should be:
  - split equally (between all selected members)
  - split unequally, which should allow selecting how much was payed on each person

# Implemented Features


# Depracated Features

