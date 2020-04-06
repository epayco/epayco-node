# Epayco

Node wrapper for Epayco API

## Description

API to interact with Epayco <https://epayco.co/docs/api/>

## Installation

As usual, you can install it using npm.

```
$ npm i epayco-sdk-node
```

## Usage

```javascript
var epayco = require('epayco-sdk-node')({
    apiKey: 'PUBLIC_KEY',
    privateKey: 'PRIVATE_KEY',
    lang: 'ES',
    test: true
})
```

### Create Token

```javascript
var credit_info = {
    "card[number]": "4575623182290326",
    "card[exp_year]": "2025",
    "card[exp_month]": "12",
    "card[cvc]": "123"
}
epayco.token.create(credit_info)
    .then(function(token) {
        console.log(token);
    })
    .catch(function(err) {
        console.log("err: " + err);
    });
```

### Customers

#### Create

```javascript
var customer_info = {
    token_card: "toke_id",
    name: "Joe",
    last_name: "Doe", 
    email: "joe@payco.co",
    default: true,
    //Optional parameters: These parameters are important when validating the credit card transaction
    city: "Bogota",
    address: "Cr 4 # 55 36",
    phone: "3005234321",
    cell_phone: "3010000001"
}
epayco.customers.create(customer_info)
    .then(function(customer) {
        console.log(customer);
    })
    .catch(function(err) {
        console.log("err: " + err);
    });
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

#### Delete Token

```javascript
var delete_customer_info = {
    franchise : "visa",
    mask : "457562******0326",
    customer_id:"id_customer"
}
epayco.customers.delete(delete_customer_info)
    .then(function(customer) {
        console.log(customer);
    })
    .catch(function(err) {
        console.log("err: " + err);
    });
```


#### Add new token default to card existed

```javascript
var addDefaultCard_customer = {
    franchise : "visa",
    token : "**********zL4gFB",
    mask : "457562******0326",
    customer_id:"id_customer"
}
epayco.customers.addDefaultCard(addDefaultCard_customer)
    .then(function(customer) {
        console.log(customer);
    })
    .catch(function(err) {
        console.log("err: " + err);
    });
```

#### add new token to customer existed

```javascript
var add_customer_info = {
    token_card : "FevpWP4fwB4v6NMG2",
    customer_id:"id_customer"
}
epayco.customers.addNewToken(add_customer_info)
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
    doc_number: "5234567",
    //Optional parameter: if these parameter it's not send, system get ePayco dashboard's url_confirmation
    url_confirmation: "https://ejemplo.com/confirmacion",
    method_confirmation: "POST",
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
    doc_number: "5234567",
    ip:"190.000.000.000" /*This is the client's IP, it is required */
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
    ip:"190.000.000.000", /*This is the client's IP, it is required */
    url_response: "https://ejemplo.com/respuesta.html",
    url_confirmation: "https://ejemplo.com/confirmacion",
    method_confirmation: "GET",

    //Extra params: These params are optional and can be used by the commerce
        extra1: "",
        extra2: "",
        extra3: "",
        extra4: "",
        extra5: "",
        extra6: ""
    
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
#### Split Payments

Previous requirements:
https://docs.epayco.co/tools/split-payment

```javascript
var split_payment_info = {
    //Other customary parameters...
    splitpayment: "true",
    split_app_id: "P_CUST_ID_CLIENTE APPLICATION",
    split_merchant_id: "P_CUST_ID_CLIENTE COMMERCE",
    split_type: "02",
    split_primary_receiver: "P_CUST_ID_CLIENTE APPLICATION",
    split_primary_receiver_fee: "10",
    split_receivers: [{id:"P_CUST_ID_CLIENTE 1ST RECEIVER",fee:"1000",fee_type: "01"}]
}
epayco.bank.create(split_payment_info)
    .then(function(charge) {
        console.log(charge);
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
    end_date: "2020-12-05",
    ip:"190.000.000.000", /*This is the client's IP, it is required */
    url_response: "https://ejemplo.com/respuesta.html",
    url_confirmation: "https://ejemplo.com/confirmacion",
    method_confirmation: "GET",

    //Extra params: These params are optional and can be used by the commerce
    extras: {
        extra1: "",
        extra2: "",
        extra3: "",
        extra4: "",
        extra5: "",
        extra6: ""
    }
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

#### list

```javascript
epayco.cash.create("efecty", cash_info)
epayco.cash.create("gana", cash_info) 
epayco.cash.create("baloto", cash_info)//expiration date can not be longer than 30 days
epayco.cash.create("redservi", cash_info)//expiration date can not be longer than 30 days
epayco.cash.create("puntored", cash_info)//expiration date can not be longer than 30 days
```

#### Split Payments

Previous requirements:
https://docs.epayco.co/tools/split-payment

```javascript
var split_cash_info = {
    //Other customary parameters...
    splitpayment: "true",
    split_app_id: "P_CUST_ID_CLIENTE APPLICATION",
    split_merchant_id: "P_CUST_ID_CLIENTE COMMERCE",
    split_type: "02",
    split_primary_receiver: "P_CUST_ID_CLIENTE APPLICATION",
    split_primary_receiver_fee: "10",
    split_receivers: JSON.stringify([{id:"P_CUST_ID_CLIENTE 1ST RECEIVER",fee:"1000",fee_type: "01"}])
}
epayco.cash.create("efecty", split_cash_info)
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
    dues: "12",
    ip:"190.000.000.000", /*This is the client's IP, it is required */
    url_response: "https://ejemplo.com/respuesta.html",
    url_confirmation: "https://ejemplo.com/confirmacion",
    method_confirmation: "GET",

    //Extra params: These params are optional and can be used by the commerce

    use_default_card_customer: true,/*if the user wants to be charged with the card that the customer currently has as default = true*/
   
   extras: {
        extra1: "",
        extra2: "",
        extra3: "",
        extra4: "",
        extra5: "",
        extra6: ""
    }
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
#### Split Payments

Previous requirements:
https://docs.epayco.co/tools/split-payment

```javascript
var split_payment_info = {
    //Other customary parameters...
    splitpayment: "true",
    split_app_id: "P_CUST_ID_CLIENTE APPLICATION",
    split_merchant_id: "P_CUST_ID_CLIENTE COMMERCE",
    split_type: "02",
    split_primary_receiver: "P_CUST_ID_CLIENTE APPLICATION",
    split_primary_receiver_fee: "10",
    split_receivers: [{id:"P_CUST_ID_CLIENTE 1ST RECEIVER",fee:"1000",fee_type: "01"}]
}
epayco.charge.create(split_payment_info)
    .then(function(charge) {
        console.log(charge);
    })
    .catch(function(err) {
        console.log("err: " + err);
    });
```




