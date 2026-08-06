/**
 * Default Short PO letterhead, terms & annexure
 * Adapted from Refex SugarCRM AOS Quotes PO template.
 */

export const SHORT_PO_LETTERHEAD_DEFAULTS = {
  title: 'Short PO',
  letterheadHeader:
    '<p style="text-align:center;"><strong>PURCHASE ORDER</strong></p>',
  terms: [
    {
      termsHeader: 'Inco Terms',
      termsDescription: '<p>As specified in this Purchase Order (Incoterms field).</p>',
    },
    {
      termsHeader: 'Delivery Schedule',
      termsDescription:
        '<p>Delivery shall be completed on or before the expected delivery date mentioned in this Purchase Order.</p>',
    },
    {
      termsHeader: 'Mode of Shipment',
      termsDescription: '<p>As agreed and specified under the applicable Incoterms / delivery instructions in this PO.</p>',
    },
    {
      termsHeader: 'Payment Terms',
      termsDescription: '<p>As specified in the Payment Terms of this Purchase Order.</p>',
    },
    {
      termsHeader: 'Note',
      termsDescription:
        '<p>I. This is a fixed-price contract and there will be no change in unit rates till 100% of supplies are done.</p>',
    },
    {
      termsHeader: 'Annexures',
      termsDescription: '<p>Annexure I: Commercial terms &amp; conditions</p>',
    },
  ],
  annexure: [
    {
      termsHeader: 'Parties',
      termsDescription: `<p>This Purchase Order is issued by <strong>M/s [Company Name]</strong> hereinafter referred as a Service recipient; to <strong>M/s [Vendor Name]</strong>, hereinafter referred as the Service Provider. The Service recipient &amp; the Service provider will be referred collectively as parties to this contract.</p>
<p>This purchase order/work order shall constitute the contract (“order”)</p>`,
    },
    {
      termsHeader: 'Effective date and term',
      termsDescription: `<p>This Order will come into effect from the date of acceptance or deemed acceptance of this Order (effective date). This Order shall be in force from the effective date for a period of one year, unless terminated in accordance with clause 11 of this PO. The validity of this Order may be extended by the Parties on such terms as may be mutually agreed upon by and between the Parties in writing.</p>`,
    },
    {
      termsHeader: 'Taxes, duties, levies & Income Tax',
      termsDescription: `<p>The GST at prevailing rates is included in the contract price. The Service recipient shall deduct the TDS from each running bill of the contractor as per the applicable tariff and rules and issue TDS certificate to the contractor</p>`,
    },
    {
      termsHeader: 'Acceptance of Order',
      termsDescription: `<p>This Order will be deemed accepted by the Service provider upon the first of the following to occur: (a) Service provider making, signing, or delivering to Service Recipient any letter, form, or other writing or instrument acknowledging acceptance; (b) any performance by Service provider under the Order; or (c) the passage of two (2) days after Service provider’s receipt of the Order without written notice to Service Recipient that Service provider does not accept. This Order, together with any documents incorporated herein by reference, constitutes the sole and entire agreement of the parties with respect to the Order and supersedes all prior or contemporaneous understandings, agreements, negotiations, representations and warranties, and communications, both written and oral, with respect to the subject matter of the Order, unless a separate overriding written contract has been entered into and signed by the parties.</p>`,
    },
    {
      termsHeader: 'Delivery',
      termsDescription: `<p>i) Delivery time is the essence of this order and must be strictly adhered to. Service provider shall deliver the Goods at the delivery point (the “Deliver Location”), and on the date(s) specified in this Order (the “Delivery Date”). If no delivery date is specified, Service provider shall deliver in full within a reasonable time of receipt of the Order.</p>
<p>ii) If the Service provider fails to deliver the Goods in full, on the Delivery Date, the Service Recipient may, at its sole discretion:</p>
<p>(a) treat the order as cancelled at any time and recover any loss or damage from the Service provider;</p>
<p>(b) purchase the goods ordered or any part thereof from other sources on the Service provider’s account, in which case, the Service provider shall be liable to pay the Service Recipient not only the difference between the price at which such goods have been actually purchased and the price calculated at the rate set out in this order but also any other loss or damage the Service Recipient may suffer;</p>
<p>Without prejudice to above provision Service Recipient may accept the late delivery, subject to a deduction in payment of 0.5% of the total order price for every week or part thereof of the delay, towards liquidated damages, subject to a maximum deduction of 5% of the order price.</p>`,
    },
    {
      termsHeader: 'Liquidated Damages',
      termsDescription: `<p>All efforts to complete the delivery within the stipulated delivery period should be made by the Service provider, a grace period of 10 days from the date of delivery period shall be provided to the Service provider, if the Service provider fails to adhere to complete the delivery within the grace period, Service Recipient has right to demand Credit Note towards liquidated damages at the rate of 1 % per week of delay subject to maximum of 10 % of order value. If the delay in delivery is for more than one month from the completion of grace period, the Service Recipient reserves the right to cancel the order or make purchase from alternative source at the risk and cost of the Service provider.</p>
<p>The Parties further acknowledge that (i) the amount of loss or damages likely to be incurred is incapable or is difficult to precisely estimate, (ii) the amounts specified above are a genuine pre-estimate of the damages and bear a reasonable relationship to, and are not plainly or grossly disproportionate to, the probable loss likely to be incurred in connection with any failure by the Service provider to fulfil the obligations under this contract, (iii) the Service Recipient and Service provider are sophisticated business Parties and have been represented by sophisticated and able legal counsel and negotiated this Order at arm's length.</p>`,
    },
    {
      termsHeader: 'Dispute Resolution',
      termsDescription: `<p>i) In the event of any difference or dispute between the Parties occurring from or arising out of this order including any question regarding the existence, validity, or termination of the contract, Parties shall attempt at resolving the same by mutual agreement within a period of seven days from the date such difference or dispute arises.</p>
<p>ii) Any difference or dispute remaining unresolved shall be referred to and finally resolved by arbitration in accordance with the Arbitration and Conciliation Act, 1996 (as amended to date).</p>
<p>iii) The Arbitral Tribunal shall comprise of a sole arbitrator to be appointed by Service Recipient. The arbitration shall be held in Chennai. The language to be used in the arbitration shall be English.</p>
<p>This contract is subject to and shall be governed by the laws of India. Courts in Chennai shall have exclusive jurisdiction for any applications/ petitions in relation to the arbitral proceedings.</p>`,
    },
    {
      termsHeader: 'Right of Service Recipient Set Off',
      termsDescription: `<p>The Service Recipient shall be entitled to recover from the Service provider, all dues to the Service Recipient on account of damages, penalty or otherwise whether in respect of supplies under this order or under by deducting such sums from the amount payable to the Service provider in respect of supplies made under this order or under any of their prior or subsequent order.</p>
<p>The Service Recipient at its sole discretion be entitled to recover or set off from the Service provider, all dues to the Service Recipient or any of its affiliates/group companies on account of damages, penalty or otherwise whether in respect of supplies under any other work order by deducting such sums from the amount payable to the Service provider in respect of supplies made under this order or under any of their prior or subsequent order.</p>`,
    },
    {
      termsHeader: 'Limitation of Liability',
      termsDescription: `<p>Notwithstanding anything contained in this order, its appendices or orders to the contrary, with respect to any and all claims arising out of the performance or non-performance of obligations under this order or purchase orders, whether arising in contract, tort, warranty, strict liability or otherwise, Service provider’s liability shall not exceed in the aggregate 100% of the purchase order value.</p>`,
    },
    {
      termsHeader: 'Consequential Losses',
      termsDescription: `<p>Service Recipient shall in no event be liable to Service provider for loss of profit, loss of revenues, loss of use, loss of production, costs of capital or costs connected with interruption of operation, loss of anticipated savings, or for any special, indirect or consequential damage or loss of any nature whatsoever.</p>`,
    },
    {
      termsHeader: 'Indemnification',
      termsDescription: `<p>Without limiting any other remedy of the Service Recipient, the Service provider shall at its own expense, defend, indemnify and hold harmless the Service Recipient’s parent company, its subsidiaries, affiliates, successors or assigns, and its directors, officers, employees, agents, and customers (Indemnitee’s) from and against any and all loss, cost, expense, damages, claims, proceedings, actions, judgment, interest, penalty, cost or expense, demands or liability, including legal counsel fees and expenses and the cost of enforcing any right to indemnification, incurred or suffered by the Service Recipient resulting from bodily injury, sickness, disease, or death of persons, or damage to property arising out of or in connection with the Service provider’s performance of this order including but not limited to:</p>
<p>i) non-compliance with the Service Recipient’s specification requirements;</p>
<p>ii) negligence or wilful misconduct of the Service provider, its employees, contractors, Service provider s, or agents;</p>
<p>iii) defects in the workmanship, materials, or design of the goods supplied, work performed by the Service provider;</p>
<p>iv) failure to comply with central, state, or local laws; or</p>
<p>v) breach of this order.</p>
<p>vi) infringes or misappropriates the patent, copyright, trade secret, or other intellectual property rights of any third party.</p>
<p>Service provider shall not enter into any settlement without Service Recipient’s or Indemnitee’s aforesaid prior written consent.</p>`,
    },
    {
      termsHeader: 'Termination/ Cancellation of Order',
      termsDescription: `<p>i) Service Recipient may terminate or cancel this Order, in whole or in part, for any reason upon thirty (30) days prior written notice to Service provider. In addition to any remedies provided herein, Service Recipient may terminate this Order with immediate effect, either before or after acceptance of Goods if the Service provider has breached any of the Terms herein.</p>
<p>ii) If the Service provider becomes insolvent, commences, or has commenced by it or against it bankruptcy proceedings, receivership, reorganization or assignment for the benefit of creditors, then the Service Recipient may terminate this Order.</p>
<p>If the Service Recipient terminates the Order for any reason, Service provider's sole and exclusive remedy is payment for the Goods received and accepted by the Service Recipient prior to the termination. However, such remedy of the Service provider is subject to Service Recipient not raising any deficiency in performance of the obligations of the Service provider under this Order.</p>
<p>iii) If the Buyer terminates the Order for any reason, Seller's sole and exclusive remedy is payment for the Goods received and accepted by the Buyer prior to the termination. However, such remedy of the Seller is subject to Buyer not raising any deficiency in performance of the obligations of the Seller under this Order.</p>`,
    },
  ],
};
