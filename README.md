# Epayco

Node wrapper for Epayco API

## Description

API to interact with Epayco <https://api.epayco.co>

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
    "card[cvc]": "123",
    "hasCvv": true //hasCvv: validar codigo de seguridad en la transacción 
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
var customer_list = {
    page: 6, //number of pages
    perPage: 10 //number of customers per page
}
epayco.customers.list(customer_list)
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
    trial_days: 30,
    iva:5700,
    ico:0,
    planLink: "https://ejemplo.com/plan",
    greetMessage: "Gracias por preferirnos",
    linkExpirationDate:"2025-03-11",
    subscriptionLimit:10,
    imgUrl:"https://ejemplo.com/imagen",
    discountValue:5000,
    discountPercentage:19,
    transactionalLimit:5,
    additionalChargePercentage:0.0,
    firstPaymentAdditionalCost:45700
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

#### Update

```javascript
var plan_info = {
    name: "Course react js",
    description: "Course react and redux",
    amount: 11900,
    currency: "cop",
    interval: "month",
    interval_count: 1,
    trial_days: 0,
    ip: "170.00.000.000",
    iva: 1900,
    ico: 0,
    transactionalLimit: 3,
    additionalChargePercentage:0.0,
    afterPayment:"message after paying"
}
epayco.plans.update("id_plan",plan_info)
.then(function(plan) {
    console.log(plan);
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


#### Listar bancos

```javascript
epayco.bank.getBanks()
    .then(function(bank) {
        console.log(bank);
     })
    .catch(function(err) {
         console.log("err:" + err);
     });
```

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
    city: "Bogota",
    cell_phone: "3010000001",
    ip:"190.000.000.000", /*This is the client's IP, it is required */
    url_response: "https://ejemplo.com/respuesta.html",
    url_confirmation: "https://ejemplo.com/confirmacion",
    metodoconfirmacion : "GET",

    //Los parámetros extras deben ser enviados tipo string, si se envía tipo array generara error.
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
epayco.bank.get("ticketId")
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

#### Split payment
use the following attributes in case you need to do a dispersion
```javascript
var split_payment_info = {
    //Other customary parameters...
    splitpayment: "true",
    split_app_id: "P_CUST_ID_CLIENTE APPLICATION",
    split_merchant_id: "P_CUST_ID_CLIENTE COMMERCE",
    split_type: "02",
    split_primary_receiver: "P_CUST_ID_CLIENTE APPLICATION",
    split_primary_receiver_fee: "0",
    split_rule: "multiple", // si se envía este parámetro split_receivers se vuelve obligatorio
    split_receivers: JSON.stringify([
        {id:"P_CUST_ID_CLIENTE 1ST RECEIVER",total:"58000",iva:"8000",base_iva:"50000", fee:"10"},
        {id:"P_CUST_ID_CLIENTE 2ND RECEIVER",total:"58000",iva:"8000",base_iva:"50000", fee:"10"}
    ]) // Campo obligatorio sí se envía el split_rule
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
    country: "CO",
    city: "bogota",
    cell_phone: "3010000001",
    end_date: "2020-12-05",
    ip:"190.000.000.000", /*This is the client's IP, it is required */
    url_response: "https://ejemplo.com/respuesta.html",
    url_confirmation: "https://ejemplo.com/confirmacion",
    metodoconfirmacion: "GET",

    //Los parámetros extras deben ser enviados tipo string, si se envía tipo array generara error.

        extra1: "",
        extra2: "",
        extra3: "",
        extra4: "",
        extra5: "",
        extra6: ""

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
epayco.cash.create("sured", cash_info)//expiration date can not be longer than 30 days
```

#### Split Payments

Previous requirements:
https://docs.epayco.co/tools/split-payment
#### Split 1-1
```javascript
var split_cash_info = {
    //Other customary parameters...
    splitpayment: "true",
    split_app_id: "P_CUST_ID_CLIENTE APPLICATION",
    split_merchant_id: "P_CUST_ID_CLIENTE COMMERCE",
    split_type: "02",
    split_primary_receiver: "P_CUST_ID_CLIENTE APPLICATION",
    split_primary_receiver_fee: "10"
}
epayco.cash.create("efecty", split_cash_info)
    .then(function(cash) {
        console.log(cash);
    })
    .catch(function(err) {
        console.log("err: " + err);
    });
```
#### Split Multiple:
use the following attributes in case you need to do a dispersion with multiple providers

```javascript
var split_payment_info = {
    //Other customary parameters...
    splitpayment: "true",
    split_app_id: "P_CUST_ID_CLIENTE APPLICATION",
    split_merchant_id: "P_CUST_ID_CLIENTE COMMERCE",
    split_type: "02",
    split_primary_receiver: "P_CUST_ID_CLIENTE APPLICATION",
    split_primary_receiver_fee: "0",
    split_rule: "multiple",// si se envía este campo el campo split_receivers sería obligatorio
    split_receivers: JSON.stringify([
        {id:"P_CUST_ID_CLIENTE 1ST RECEIVER",total:"58000",iva:"8000",base_iva:"50000", fee:"10"},
        {id:"P_CUST_ID_CLIENTE 2ND RECEIVER",total:"58000",iva:"8000",base_iva:"50000", fee:"10"}
    ]) // Campo obligatorio sí se envía el campo split_rule
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
    doc_number: "10358519",
    name: "John",
    last_name: "Doe",
    email: "example@email.com",
    city: "Bogota",
    address: "Cr 4 # 55 36",
    phone: "3005234321",
    cell_phone: "3010000001",
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

    //Los parámetros extras deben ser enviados tipo string, si se envía tipo array generara error.

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

#### Split payment
use the following attributes in case you need to do a dispersion with one or multiple providers

```javascript
var split_payment_info = {
    //Other customary parameters...
    splitpayment: "true",
    split_app_id: "P_CUST_ID_CLIENTE APPLICATION",
    split_merchant_id: "P_CUST_ID_CLIENTE COMMERCE",
    split_type: "02",
    split_primary_receiver: "P_CUST_ID_CLIENTE APPLICATION",
    split_primary_receiver_fee: "0",
    split_rule: "multiple", // si se envía este campo el split_receivers se vuelve un campo obligatorio
    split_receivers: [
        {id:"P_CUST_ID_CLIENTE 1ST RECEIVER",total:"58000",iva:"8000",base_iva:"50000", fee:"10"},
        {id:"P_CUST_ID_CLIENTE 2ND RECEIVER",total:"58000",iva:"8000",base_iva:"50000", fee:"10"}
    ] // Campo obligatorio sí se envía split_rule
}
epayco.charge.create(split_payment_info)
    .then(function(charge) {
        console.log(charge);
    })
    .catch(function(err) {
        console.log("err: " + err);
    });
```

### Daviplata

### Create

```javascript
var body = {
    doc_type: "CC",
    document: "1053814580414720",
    name: "Testing",
    last_name: "PAYCO",
    email: "exmaple@epayco.co",
    ind_country: "CO",
    phone: "314853222200033",
    country: "CO",
    city: "bogota",
    address: "Calle de prueba",
    ip: "189.176.0.1",
    currency: "COP",
    description: "ejemplo de transaccion con daviplata",
    value: "100",
    tax: "0",
    tax_base: "0",
    method_confirmation: "GET",
    url_response: "https://ejemplo.com/respuesta.html",
    url_confirmation: "https://ejemplo.com/confirmacion",
    extra1: "",
    extra2: "",
    extra3: "",
    extra4: "",
    extra5: "",
    extra6: ""
    
}
epayco.daviplata.create(body)
    .then(function(daviplata){
        console.log(daviplata);
    }).catch(function(err){
        console.log("err: "+ err);
    })
```

### Confirm 

```javascript
epayco.daviplata.confirm({
    ref_payco: "45508846", // It is obtained from the create response
    id_session_token: "45081749", // It is obtained from the create response
    otp: "2580"
}).then(function(daviplata){
        console.log(daviplata);
    }).catch(function(err){
        console.log("err: "+ err);
    })
```

### Safetypay

## Create 

```javascript
var body = {
    cash: "1",
    end_date: "2021-08-05",
    doc_type: "CC",
    document: "123456789",
    name: "Jhon",
    last_name: "doe",
    email: "jhon.doe@yopmail.com",
    ind_country: "57",
    phone: "3003003434",
    country: "CO",
    invoice: "fac-01", // opcional
    city: "N/A",
    address: "N/A",
    ip: "192.168.100.100",
    currency: "COP",
    description: "Thu Jun 17 2021 11:37:01 GMT-0400 (hora de Venezuela)",
    value: 100000,
    tax: 0,
    ico: 0,
    tax_base: 0,
    url_confirmation: "",
    method_confirmation: "",
    extra1: "",
    extra2: "",
    extra3: "",
    extra4: "",
    extra5: "",
    extra6: ""
}

epayco.safetypay.create(body)
    .then(function(safetypay){
        console.log(safetypay);
    }).catch(function(err){
        console.log("err: "+ err);
    })
```
