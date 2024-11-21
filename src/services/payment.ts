import type { Payment } from "@/types";
import type { HttpClient } from "@/utils/http";

export class PaymentService {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  public async create(paymentData: Payment) {
    return this.http.post("/payment/v1/charge/create", paymentData);
  }

  public async get(transactionId: string) {
    return this.http.get(`/payment/v1/transaction/${transactionId}`);
  }

  public async getAll() {
    return this.http.get("/payment/v1/transactions");
  }
}
