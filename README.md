# Epayco

Node wrapper for Epayco API

## Description

API to interact with Epayco <https://epayco.co/docs/api/>

## Installation

As usual, you can install it using npm.

```
$ npm install epayco-node
```

## Usage

```javascript
const epayco = require('epayco-node')({
    apiKey: 'PUBLIC_KEY',
    privateKey: 'PRIVATE_KEY',
    lang: 'ES',
    test: true
})
```

### Create Token

```javascript
const credit_info = {
    "card[number]": "4575623182290326",
    "card[exp_year]": "2017",
    "card[exp_month]": "07",
    "card[cvc]": "123"
}

epayco.token.create(credit_info)
    .then(token => {
        console.info(token);
    })
    .catch(err => {
        console.error(`Error: ${err}`);
    });

// (async/await)
try {
    const tokenPromise = epayco.token.create(credit_info)
    const token = await tokenPromise
    console.info(token)
} catch(error) {
    console.error(`Error: ${err}`);
}

```

### Customers

#### Create

```javascript
const customer_info = {
    token_card: "toke_id",
    name: "Joe Doe",
    email: "joe@payco.co",
    phone: "3005234321",
    default: true
}
epayco.customers.create(customer_info)
    .then(customer => {
        console.log(customer)
    })
    .catch(err => {
        console.error(`Error: ${err}`);
    });

// (async/await)
try {
    const customerPromise = epayco.customers.create(customer_info)
    const customer = await customerPromise
    console.info(customer)
} catch(error) {
    console.error(`Error: ${err}`);
}

```

#### Retrieve

```javascript
epayco.customers.get("id_customer")
    .then(function(customer) {
        console.log(customer);
    })
    .catch(function(err) {
        console.log("err: " + err);
    });
```

#### List

```javascript
epayco.customers.list()
    .then(function(customers) {
        console.log(customers);
    })
    .catch(function(err) {
        console.log("err: " + err);
    });
```

#### Update

```javascript
var update_customer_info = {
    name: "Alex"
}
epayco.customers.update("id_customer", update_customer_info)
    .then(function(customer) {
        console.log(customer);
    })
    .catch(function(err) {
        console.log("err: " + err);
    });
```

### Plans

#### Create

```javascript
var plan_info = {
    id_plan: "coursereact",
    name: "Course react js",
    description: "Course react and redux",
    amount: 30000,
    currency: "cop",
    interval: "month",
    interval_count: 1,
    trial_days: 30
}
epayco.plans.create(plan_info)
    .then(function(plan) {
        console.log(plan);
    })
    .catch(function(err) {
        console.log("err: " + err);
    });
```

#### Retrieve

```javascript
epayco.plans.get("id_plan")
    .then(function(plan) {
        console.log(plan);
    })
    .catch(function(err) {
        console.log("err: " + err);
    });
```

#### List

```javascript
epayco.plans.list()
    .then(function(plans) {
        console.log(plans);
    })
    .catch(function(err) {
        console.log("err: " + err);
    });
```

#### Remove

```javascript
epayco.plans.delete("id_plan")
    .then(function(plan) {
        console.log(plan);
    })
    .catch(function(err) {
        console.log("err: " + err);
    });
```

### Subscriptions

#### Create

```javascript
var subscription_info = {
    id_plan: "-id_plan",
    customer: "id_customer",
    token_card: "id_token",
    doc_type: "CC",
    doc_number: "5234567"
}
epayco.subscriptions.create(subscription_info)
    .then(function(subscription) {
        console.log(subscription);
    })
    .catch(function(err) {
        console.log("err: " + err);
    });
```

#### Retrieve

```javascript
begin
epayco.subscriptions.get("id_subscription")
    .then(function(subscription) {
        console.log(subscription);
    })
    .catch(function(err) {
        console.log("err: " + err);
    });
```

#### List

```javascript
epayco.subscriptions.list()
    .then(function(subscriptions) {
        console.log(subscriptions);
    })
    .catch(function(err) {
        console.log("err: " + err);
    });
```

#### Cancel

```javascript
epayco.subscriptions.cancel("id_subscription")
    .then(function(subscription) {
        console.log(subscription);
    })
    .catch(function(err) {
        console.log("err: " + err);
    });
```

#### Pay Subscription

```javascript
var subscription_info = {
    id_plan: "-id_plan",
    customer: "id_customer",
    token_card: "id_token",
    doc_type: "CC",
    doc_number: "5234567"
}
epayco.subscriptions.charge(subscription_info)
    .then(function(subscription) {
        console.log(subscription);
    })
    .catch(function(err) {
        console.log("err: " + err);
    });
```

### PSE

#### Create

```javascript
var pse_info = {
    bank: "1022",
    invoice: "1472050778",
    description: "pay test",
    value: "10000",
    tax: "0",
    tax_base: "0",
    currency: "COP",
    type_person: "0",
    doc_type: "CC",
    doc_number: "10358519",
    name: "testing",
    last_name: "PAYCO",
    email: "no-responder@payco.co",
    country: "CO",
    cell_phone: "3010000001",
    url_response: "https:/secure.payco.co/restpagos/testRest/endpagopse.php",
    url_confirmation: "https:/secure.payco.co/restpagos/testRest/endpagopse.php",
    method_confirmation: "GET",
}
epayco.bank.create(pse_info)
    .then(function(bank) {
        console.log(bank);
    })
    .catch(function(err) {
        console.log("err: " + err);
    });
```

#### Retrieve

```javascript
epayco.bank.get("transaction_id")
    .then(function(bank) {
        console.log(bank);
    })
    .catch(function(err) {
        console.log("err: " + err);
    });
```

### Cash

#### Create

```javascript
var cash_info = {
    invoice: "1472050778",
    description: "pay test",
    value: "20000",
    tax: "0",
    tax_base: "0",
    currency: "COP",
    type_person: "0",
    doc_type: "CC",
    doc_number: "10358519",
    name: "testing",
    last_name: "PAYCO",
    email: "test@mailinator.com",
    cell_phone: "3010000001",
    end_date: "2017-12-05",
    url_response: "https:/secure.payco.co/restpagos/testRest/endpagopse.php",
    url_confirmation: "https:/secure.payco.co/restpagos/testRest/endpagopse.php",
    method_confirmation: "GET",
}
epayco.cash.create("efecty", cash_info)
    .then(function(cash) {
        console.log(cash);
    })
    .catch(function(err) {
        console.log("err: " + err);
    });
```

#### Retrieve

```javascript
epayco.cash.get("transaction_id")
    .then(function(cash) {
        console.log(cash);
    })
    .catch(function(err) {
        console.log("err: " + err);
    });
```

### Payment

#### Create

```javascript
var payment_info = {
    token_card: "token_id",
    customer_id: "customer_id",
    doc_type: "CC",
    doc_number: "1035851980",
    name: "John",
    last_name: "Doe",
    email: "example@email.com",
    bill: "OR-1234",
    description: "Test Payment",
    value: "116000",
    tax: "16000",
    tax_base: "100000",
    currency: "COP",
    dues: "12"
}
epayco.charge.create(payment_info)
    .then(function(charge) {
        console.log(charge);
    })
    .catch(function(err) {
        console.log("err: " + err);
    });
```

#### Retrieve

```javascript
epayco.charge.get("transaction_id")
    .then(function(charge) {
        console.log(charge);
    })
    .catch(function(err) {
        console.log("err: " + err);
    });
```
