/* Dedicated raw-request webhook endpoint for Razorpay TEST signatures. */
import {handleTestWebhook} from './razorpay-test.js';
// If deployed through a framework, keep this route's body parser disabled.
export const config={api:{bodyParser:false}};
export default async function razorpayWebhook(req,res){return handleTestWebhook(req,res)}
