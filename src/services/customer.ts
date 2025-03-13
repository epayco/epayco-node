import type { Customer } from "@/types";
import type { HttpClient } from "@/utils/http";

export class CustomerService {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  public async create(customerData: Customer) {
    return this.http.post<Customer>(
      "/payment/v1/customer/create",
      customerData,
    );
  }

  public async get(customerId: string) {
    return this.http.get<Customer>(`/payment/v1/customer/${customerId}`);
  }

  public async list() {
    return this.http.get<Customer[]>("/payment/v1/customers");
  }

  public async update<Customer>(
    customerId: string,
    customerData: Partial<Customer>,
  ) {
    return this.http.post(
      `/payment/v1/customer/edit/${customerId}`,
      customerData,
    );
  }
}
