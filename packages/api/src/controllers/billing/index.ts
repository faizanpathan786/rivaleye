import { Elysia } from "elysia";
import { getBalanceHandler } from "./handlers/getBalance";
import { getPacksHandler } from "./handlers/getPacks";
import { createOrderHandler } from "./handlers/createOrder";
import { verifyPaymentHandler } from "./handlers/verifyPayment";
import { getTransactionsHandler } from "./handlers/getTransactions";
import { razorpayWebhookHandler } from "./handlers/webhook";

export const billingController = new Elysia({ prefix: "/billing", tags: ["billing"] })
  .use(getBalanceHandler)
  .use(getPacksHandler)
  .use(createOrderHandler)
  .use(verifyPaymentHandler)
  .use(getTransactionsHandler)
  .use(razorpayWebhookHandler);
