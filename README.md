# Epayco

Node wrapper for Epayco API with TypeScript support

## Description

API to interact with Epayco <https://api.epayco.co>

## Installation

```bash
npm i @lifeworldb/epayco-sdk-node-ts

yarn add
```

## Usage

```typescript
import Epayco from 'epayco-sdk-node-ts';
import { EpaycoOptions } from 'epayco-sdk-node-ts/types';

const epaycoOptions: EpaycoOptions = {
    apiKey: 'PUBLIC_KEY',
    privateKey: 'PRIVATE_KEY',
    lang: 'ES',
    test: true
};

const epayco = new Epayco(epaycoOptions);
```

### Create Token

```typescript
import type { CreditCardInfo } from 'epayco-sdk-node-ts/types';

const credit_info: CreditCardInfo = {
    "card[number]": "4575623182290326",
    "card[exp_year]": "2025",
    "card[exp_month]": "12",
    "card[cvc]": "123",
    hasCvv: true //hasCvv: validate security code in transaction
};

try {
    const token = await epayco.token.create(credit_info);
    console.log(token);
} catch (err) {
    console.log("err:", err);
}
```

### Customers

#### Create

```typescript
import type { CustomerInfo } from 'epayco-sdk-node-ts/types';

const customer_info: CustomerInfo = {
    token_card: "token_id",
    name: "Joe",
    last_name: "Doe",
    email: "joe@payco.co",
    default: true,
    // Optional parameters: These parameters are important when validating the credit card transaction
    city: "Bogota",
    address: "Cr 4 # 55 36",
    phone: "3005234321",
    cell_phone: "3010000001"
};

try {
    const customer = await epayco.customers.create(customer_info);
    console.log(customer);
} catch (err) {
    console.log("err:", err);
}
```

#### Retrieve

```typescript
try {
    const customer = await epayco.customers.get("id_customer");
    console.log(customer);
} catch (err) {
    console.log("err:", err);
}
```

#### List

```typescript
try {
    const customers = await epayco.customers.list();
    console.log(customers);
} catch (err) {
    console.log("err:", err);
}
```

#### Update

```typescript
import type { GenericObject } from 'epayco-sdk-node-ts/types';

const update_customer_info: GenericObject = {
    name: "Alex"
};

try {
    const customer = await epayco.customers.update("id_customer", update_customer_info);
    console.log(customer);
} catch (err) {
    console.log("err:", err);
}
```

#### Delete Token

```typescript
interface DeleteCustomerInfo {
    franchise: string;
    mask: string;
    customer_id: string;
}

const delete_customer_info: DeleteCustomerInfo = {
    franchise: "visa",
    mask: "457562******0326",
    customer_id: "id_customer"
};

try {
    const customer = await epayco.customers.delete(delete_customer_info);
    console.log(customer);
} catch (err) {
    console.log("err:", err);
}
```

#### Add new default token to existing card

```typescript
interface AddDefaultCardInfo {
    franchise: string;
    token: string;
    mask: string;
    customer_id: string;
}

const addDefaultCard_customer: AddDefaultCardInfo = {
    franchise: "visa",
    token: "**********zL4gFB",
    mask: "457562******0326",
    customer_id: "id_customer"
};

try {
    const customer = await epayco.customers.addDefaultCard(addDefaultCard_customer);
    console.log(customer);
} catch (err) {
    console.log("err:", err);
}
```

### Plans

#### Create

```typescript
interface PlanInfo {
    id_plan: string;
    name: string;
    description: string;
    amount: number;
    currency: string;
    interval: string;
    interval_count: number;
    trial_days: number;
}

const plan_info: PlanInfo = {
    id_plan: "coursereact",
    name: "Course react js",
    description: "Course react and redux",
    amount: 30000,
    currency: "cop",
    interval: "month",
    interval_count: 1,
    trial_days: 30
};

try {
    const plan = await epayco.plans.create(plan_info);
    console.log(plan);
} catch (err) {
    console.log("err:", err);
}
```

### PSE

#### Create transaction

```typescript
interface PseInfo {
    bank: string;
    invoice: string;
    description: string;
    value: string;
    tax: string;
    tax_base: string;
    currency: string;
    type_person: string;
    doc_type: string;
    doc_number: string;
    name: string;
    last_name: string;
    email: string;
    country: string;
    cell_phone: string;
    ip: string;
    url_response: string;
    url_confirmation: string;
    metodoconfirmacion: string;
    extra1?: string;
    extra2?: string;
    extra3?: string;
    extra4?: string;
    extra5?: string;
    extra6?: string;
}

const pse_info: PseInfo = {
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
    ip: "190.000.000.000",
    url_response: "https://example.com/response.html",
    url_confirmation: "https://example.com/confirmation",
    metodoconfirmacion: "GET"
};

try {
    const bank = await epayco.bank.create(pse_info);
    console.log(bank);
} catch (err) {
    console.log("err:", err);
}
```

Would you like me to continue with the remaining examples for:
- Split Payments
- Cash
- Payment
- Daviplata
- Safetypay