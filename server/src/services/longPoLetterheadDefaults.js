/**
 * Default Long PO letterhead, terms & annexure
 * Adapted from Refex SugarCRM AOS Quotes Long PO template.
 */

export const LONG_PO_LETTERHEAD_DEFAULTS = {
  title: 'Long PO',
  letterheadHeader:
    '<p style="text-align:center;"><strong>PURCHASE ORDER</strong></p>',
  terms: [
    {
      termsHeader: 'Quote No',
      termsDescription: '<p>$aos_quotes_quote_no_c</p>',
    },
    {
      termsHeader: 'Inco Terms',
      termsDescription: '<p>$aos_quotes_inco_terms_c</p>',
    },
    {
      termsHeader: 'Delivery Schedule',
      termsDescription: '<p>$aos_quotes_delivery_schedule_c</p>',
    },
    {
      termsHeader: 'Mode of Shipment',
      termsDescription: '<p>$aos_quotes_shipment_mode_c</p>',
    },
    {
      termsHeader: 'Payment Terms',
      termsDescription: '<p>$aos_quotes_payment_terms_c</p>',
    },
    {
      termsHeader: 'Note',
      termsDescription: '<p>$aos_quotes_notes_c</p>',
    },
    {
      termsHeader: 'Annexures',
      termsDescription:
        '<p>Annexure I: Commercial terms &amp; conditions<br />Annexure II: Approved technical document</p>',
    },
  ],
  annexure: [
    {
      termsHeader: 'Parties',
      termsDescription: `<p>This Purchase Order is issued by <strong>M/s [Company Name]</strong> hereinafter referred as a Buyer/Purchaser/ Customer to <strong>M/s [Vendor Name]</strong> hereinafter referred as the Seller/Supplier/Contractor/service provider as per below mentioned terms and conditions. The buyer and the seller are jointly referred to as the ‘parties’ to this order.</p>
<p>This purchase order/work order/service order shall constitute the contract (“order”)</p>`,
    },
    {
      termsHeader: 'Acceptance of Order',
      termsDescription: `<p>This order will be deemed accepted by the seller upon the first of the following to occur: (a) seller making, signing, or delivering to buyer any letter, form, or other writing or instrument acknowledging acceptance; (b) any performance by seller under the Order; or (c) the passage of two (2) working days after seller’s receipt of the order without written notice to the buyer that the seller does not accept. This order, together with any documents incorporated herein by reference, constitutes the sole and entire agreement of the parties with respect to the order and supersedes all prior or contemporaneous understandings, agreements, negotiations, representations and warranties, and communications, both written and oral, with respect to the subject matter of the order, unless a separate overriding written contract has been entered into and signed by the parties. The order expressly limits seller’s acceptance to the terms of the order. These Terms expressly exclude any of seller’s terms and conditions of sale or any other document issued by the seller in connection with this order.</p>`,
    },
    {
      termsHeader: 'Effective date and term',
      termsDescription: `<p>This order will come into effect from the date of acceptance or deemed acceptance as mentioned in clause no 2. This order shall be in force till such time that the obligations of the parties under this order are fulfilled. The validity of this Order may be extended by the parties on such terms as may be mutually agreed upon by and between the parties in writing.</p>`,
    },
    {
      termsHeader: 'Packing',
      termsDescription: `<p>The seller shall ensure that the goods processed and supplied against this order are properly packed and dispatched conforming to special instructions, if any, given for safe transport by road/rail/air/water to the specified destination.</p>`,
    },
    {
      termsHeader: 'Delivery',
      termsDescription: `<p>i) Delivery time is the essence of this order and must be strictly adhered to. Seller shall deliver the goods at the delivery point (the “Deliver Location”), and on the date(s) specified in this order (the “Delivery Date”). If no delivery date is specified, Seller shall deliver in full within a reasonable time of receipt of the order.</p>
<p>ii) If the seller fails to deliver the goods in full, on the delivery date, the buyer may, at its sole discretion:</p>
<p>(a) treat the order as cancelled and recover any loss or damage from the seller;</p>
<p>(b) purchase the goods ordered or any part thereof from other sources on the seller’s account, in which case, the seller shall be liable to pay the buyer not only the difference between the price at which such goods have been actually purchased and the price calculated at the rate set out in this order, but also any other loss or damage the buyer may suffer;</p>
<p>Without prejudice to above provision the buyer may accept the late delivery, subject to a deduction in payment of 1% of the total order price for every week or part thereof of the delay, towards the liquidated damages, subject to maximum deduction of 10% of the order price.</p>
<p>For the purpose of establishing the timeliness for deliveries involving installation, commissioning or rectification, the relevant point in time shall be the date of acceptance.</p>`,
    },
    {
      termsHeader: 'Documents to be submitted along with dispatch to the buyer',
      termsDescription: `<p>a) GST invoice Original</p>
<p>b) Duplicate for Transport</p>
<p>c) Commercial Invoice</p>
<p>d) LR Copy – Original Consignee</p>
<p>e) Packing List</p>
<p>f) Routine test Certificate – Original</p>
<p>g) Guarantee/Warranty Certificate – Original</p>
<p>h) Copy of filled road permit</p>
<p>i) Copy of material dispatch clearance</p>
<p>j) Transmit insurance certificate / declaration certificate for above consignment</p>
<p>k) Operation &amp; Maintenance Manual – Original</p>
<p>Document by Fax/Email: Seller will send to Buyer the Invoice and Packing List prior to dispatch for Insurance. LR copy by Fax / Email within 2 hrs of dispatch.</p>`,
    },
    {
      termsHeader: 'Dispatch Instructions',
      termsDescription: `<p>As soon as the goods are ready for dispatch, the seller shall intimate in writing to the buyer seeking the clearance for dispatching the goods. Seller shall not dispatch the goods before receiving buyer’s dispatch clearance.</p>`,
    },
    {
      termsHeader: 'Identification',
      termsDescription: `<p>Each Shipment under this Order must be positively identified by suitable marking on the outside of each package.</p>`,
    },
    {
      termsHeader: 'Warranty and Guarantee for the Goods',
      termsDescription: `<p>i) All Goods, furnished in connection with will: (a) be new and free from any defects in workmanship, material and design; (b) conform to applicable specifications; (c) be fit for their intended purpose and operate as intended; (d) be free and clear of all liens, security interests or other encumbrances; and do not infringe or misappropriate any third party’s intellectual property rights. If the buyer gives the seller a notice of noncompliance, the seller shall, at its own cost and expense, promptly replace or repair the nonconforming Goods.</p>
<p>ii) If deficiency is identified before or during the transfer of risk or during the Guarantee/Warranty Period set out in this order, the seller must at its own expense and at the discretion of the buyer either repair the deficiency or provide re- performance or replacement of delivery. This provision also applies to delivery subject to inspection by sample test. The discretion of the buyer shall be exercised fairly and reasonably.</p>
<p>iii) The seller shall be bound to repair/replace free of cost any materials/goods/assets processed and supplied by him, which becomes defective due to faulty design, material or workmanship or any other reason within ______ months from the date of completion of final installation &amp; commissioning or _______ months from the date of delivery whichever is earlier. In all such cases the to and fro freight and insurance charges will be to the seller’s account.</p>
<p>iv) Should the seller fail to rectify (i.e. repair or replacement) any deficiency within a reasonable time period set by the buyer, the buyer is entitled to: cancel the order in whole or in part without being subject to any liability for damages; or demand a reduction in price; or undertake itself any repair at the expense of the seller or re-performance or replacement of deliveries or arrange for such to be done and claim damages in lieu of performance.</p>`,
    },
    {
      termsHeader: 'Quality, assurance, risk purchase',
      termsDescription: `<p>i) The goods shall correspond with the description or the sample or the original specification thereof in all details, otherwise the same shall be liable to be rejected by the buyer and the seller shall be deemed to have wrongfully neglected to deliver the goods according to the contract. The buyer’s decision in matter of quality will be final and binding. Besides the seller shall be liable for the latent defects &amp; shall stand guarantee for replacement of any parts/material for a further period of five years from the end of guarantee period.</p>
<p>ii) In addition to the above, the buyer shall have the right to purchase/avail the goods ordered or any part thereof from other sources on the seller’s account, in which case the seller shall be liable to pay the buyer not only the difference between the price at which such goods have been actually purchased and the price calculated at the rate set out in this order, but also any other loss or damage the Buyer may suffer.</p>`,
    },
    {
      termsHeader: 'Inspection, Examination and Rejection and removal of Goods',
      termsDescription: `<p>i) All materials duly processed and supplied against the order should meet the buyer’s specifications without any deviations and conform to latest IS or equivalent standards. It should be new, should be of merchantable quality, fit for their intended purpose, which has to be approved in advance by the buyer in line with approved Quality assurance plan (QAP). Seller will give written advance intimation of seven (7) days to the buyer for arranging inspection.</p>
<p>ii) The buyer on its own or through its agent or third party reserves the rights to inspect the material and reject such portion thereof as may be found defective or not in conformity with the specification or not fit for their intended purpose without any commercial implications to the buyer.</p>
<p>iii) If the buyer requires replacement of the goods, pursuant to Section 12, the seller shall promptly replace the nonconforming Goods. If the seller fails to timely deliver replacement goods, the buyer may replace them with goods from a third party and charge the seller the cost thereof and terminate this order for cause pursuant to Section 28. Any inspection or other action by the buyer under this section shall not affect seller’s obligations under the order, and the buyer shall have the right to do further inspection after the seller takes the remedial action.</p>`,
    },
    {
      termsHeader: 'Acceptance of Goods and Cumulative Remedies',
      termsDescription: `<p>i) Acceptance of any of the goods by the buyer shall not discharge the seller from the liability for other legal remedy for any breach of any condition or warranty contained herein or implied by law, and if after the delivery of goods or any of them any defects therein either workmanship or otherwise become known to the buyer and such defects amount to a breach of any condition or warranty hereunder or implied by law, the buyer shall forthwith notify the seller of such defects and shall (in addition to any other rights or remedies that the buyer may possess) be entitled to reject the defective goods and hold the same at the seller’s risk and cost. The seller shall be responsible and be liable to replace or to repair at the option of the free of cost goods supplied under this order or any part thereof if any defect in the composition of substance of material or workmanship or process of manufacturing or in the design of the goods is brought to the notice of the seller within __ calendar months from the date of delivery.</p>
<p>ii) The rights and remedies under this order are cumulative and are in addition to any other rights and remedies available at law or in equity or otherwise. If seller is in breach of the warranty and guarantee set out in this order, seller will, at its sole cost, replace or repair the Goods or re-perform to buyer’s satisfaction.</p>`,
    },
    {
      termsHeader: 'Price and Set-Off',
      termsDescription: `<p>The price of the goods is the price stated on the face of this Order (the “<strong>Price</strong>”). Seller shall invoice the buyer for the order as stated in the payment Terms on the face of this order. The price shall remain fix and firm till the complete execution of this order without any escalation. Payment of an invoice is not evidence or admission that the goods meet the requirements of the order.</p>`,
    },
    {
      termsHeader: 'Liquidated Damages',
      termsDescription: `<p>All efforts to complete the delivery within the stipulated delivery period should be made by the seller, a grace period of 10 days from the date of delivery period shall be provided to the seller. If the Seller fails to adhere to complete the delivery within the grace period, the buyer has right to demand Credit Note towards liquidated damages at the rate of 1 % per week of delay subject to maximum of 10% of the total order value. If the delay in delivery is for more than one month from the completion of grace period, the buyer reserves the right to cancel the order or to make purchase from alternative source at the risk and cost of the seller.</p>`,
    },
    {
      termsHeader: 'Confidential Information',
      termsDescription: `<p>All non-public, confidential or proprietary information of the buyer, including, but not limited to, specifications, samples, patterns, designs, plans, drawings, documents, data, business operations, pricing, discounts or rebates, disclosed by the buyer to the seller, whether disclosed orally or disclosed or accessed in written, electronic, or other form or media, and whether or not marked, designated or otherwise identified as “confidential,” in connection with this order is confidential and solely for the use of performing the order and not to be disclosed or copied unless authorized by the buyer in writing. Upon buyer’s request, the seller shall promptly return all documents and other materials received from buyer. The buyer shall be entitled to injunctive relief for any violation of this section.</p>
<p>This section shall not apply to the information that is: (a) in the public domain; (b) rightfully and legally known to the seller at the time of disclosure; or (c) rightfully and legally obtained by the seller on a non-confidential basis from a third party.</p>`,
    },
    {
      termsHeader: 'Dispute Resolution',
      termsDescription: `<p>i) In the event of any difference or dispute between the parties occurring from or arising out of this order including any question regarding existence, validity or termination of the contract, parties shall attempt at resolving the same by mutual agreement within a period of seven days from the date such difference or dispute arises.</p>
<p>ii) Any difference or dispute remaining unresolved shall be referred to and finally resolved by arbitration in accordance with the Arbitration and Conciliation Act, 1996 (as amended to date).</p>
<p>iii) The Arbitral Tribunal shall comprise of a sole arbitrator to be appointed by the buyer. The arbitration shall be held in Chennai. The language to be used in the arbitration shall be English.</p>
<p>iv) This contract is subject to and shall be governed by the laws of India. Courts in Chennai shall have exclusive jurisdiction for any applications/ petitions in relation to the arbitral proceedings.</p>`,
    },
    {
      termsHeader: 'Limitation of Liability',
      termsDescription: `<p>Notwithstanding anything contained in this order, its appendices or orders to the contrary, with respect to any and all claims arising out of the performance or non-performance of obligations under this order or purchase orders, whether arising in contract, tort, warranty, strict liability or otherwise, seller’s liability shall not exceed in the aggregate 100% of the purchase order value.</p>`,
    },
    {
      termsHeader: 'Consequential Losses',
      termsDescription: `<p>The buyer shall in no event be liable to the seller for loss of profit, loss of revenues, loss of use, loss of production, costs of capital or costs connected with interruption of operation, loss of anticipated savings or for any special, indirect or consequential damage or loss of any nature whatsoever.</p>`,
    },
    {
      termsHeader: 'Indemnification',
      termsDescription: `<p>Without limiting any other remedy of the buyer, the seller shall at its own expense, defend, indemnify and hold harmless the buyer’s parent company, its subsidiaries, affiliates, successors or assigns and its directors, officers, employees, agents and customers (Indemnitee’s) from and against any and all loss, cost, expense, damages, claims, proceedings, actions, judgment, interest, penalty, cost or expense, demands or liability, including legal counsel fees and expenses and the cost of enforcing any right to indemnification, incurred or suffered by the buyer resulting from bodily injury, sickness, disease, or death of persons, or damage to property arising out of or in connection with the seller’s performance of this order including but not limited to:</p>
<p>i) non-compliance with the buyer’s specification requirements;</p>
<p>ii) negligence or wilful misconduct of the seller, its employees, contractors, suppliers or agents;</p>
<p>iii) defects in the workmanship, materials or design of the goods supplied, work performed by the Seller;</p>
<p>iv) failure to comply with central, state or local laws; or</p>
<p>v) breach of this order.</p>
<p>vi) infringes or misappropriates the patent, copyright, trade secret or other intellectual property right of any third party.</p>
<p>Seller shall not enter into any settlement without buyer’s or Indemnitee’s aforesaid prior written consent.</p>`,
    },
    {
      termsHeader: 'Force Majeure Event and Contingency',
      termsDescription: `<p>i) Neither party shall be liable to the other for any delay or failure in performing its obligations under the order to the extent that such delay or failure is caused by an event or circumstance that is beyond the reasonable control of that party, without such party’s fault or negligence, and which by its nature could not have been foreseen by such party (<strong>“<em>Force Majeure</em> Event”</strong>). <em>Force Majeure</em> Events include, but are not limited to, acts of God or the public enemy, government restrictions, floods, fire, earthquakes, explosion, epidemic, pandemic, war, invasion, terrorist acts, riots, strike, or embargoes. Seller’s economic hardship or changes in market conditions are not considered <em>Force Majeure</em> Events. Seller shall use all diligent efforts to end the failure or delay of its performance, ensure that the effects of any <em>Force Majeure</em> Event are minimized and resume performance under the Order. If a <em>Force Majeure</em> Event prevents Seller from performance for a continuous period of more than fifteen (15) business days, Buyer may terminate this Order immediately by giving written notice to Seller.</p>
<p>ii) The buyer shall be under no liability for failure to accept the deliveries of goods, if such acts of failure are due to any act of God, War, fire, earthquake, floods, or any natural calamities or transportation embargoes, civil commotion, riots, violence, acts of terrorists, state enemies, or any other similar reasons or circumstances beyond the control of the buyer.</p>`,
    },
    {
      termsHeader: 'Termination/ Cancellation of Order',
      termsDescription: `<p>i) Buyer may terminate or cancel this order, in whole or in part, for any reason upon thirty (30) days’ prior written notice to the seller. In addition to any remedies provided herein, the buyer may terminate this order with immediate effect, either before or after acceptance of goods if the seller has breached any of the terms herein.</p>
<p>ii) If the seller becomes insolvent, commences or has commenced by it or against it bankruptcy proceedings, receivership, reorganization or assignment for the benefit of creditors, then the buyer may terminate this Order.</p>
<p>iii) If the buyer terminates the order for any reason, the seller's sole and exclusive remedy is payment for the goods received and accepted by the buyer prior to the termination. However, such remedy of the seller is subject to buyer not raising any deficiency in performance of the obligations of the seller under this order.</p>`,
    },
    {
      termsHeader: 'Compliance with Applicable Law',
      termsDescription: `<p>Seller warrants and represents to buyer that it is in compliance with and shall remain in compliance during performance of this order and ensure that its employees, agents, contractors and subcontractors (the “Personnel”) comply with all applicable laws, regulations and ordinances in force in India. Seller has and shall maintain in effect all the licenses, permissions, authorizations, consents and permits required by law to carry out its obligations under the Order. Seller assumes all responsibility for shipments of goods requiring any government clearance. If seller fails to comply with the laws, orders, rules, ordinances and regulations and as a result Buyer is fined, Seller agrees to pay the fine and costs incident thereto or reimburse Buyer for payment. To the extent that seller’s personnel are required to enter onto buyer’s site or property, seller shall ensure that personnel comply with buyer’s health, safety and environmental policies and standards.</p>`,
    },
    {
      termsHeader: 'Correspondence with Buyer',
      termsDescription: `<p>All correspondence / transaction with buyer should mention buyer’s purchase order number and the name of the purchase order issuing department and the concerned person.</p>`,
    },
    {
      termsHeader: 'Scanned Copy',
      termsDescription: `<p>Scanned transmissions (includes signed/unsigned copy received via any electronic or any other communication or hand delivery mode) of this document shall be considered as an original of the document, and shall have the same effect and force as signed hard-copy originals of the document. It shall be binding and legally enforceable.</p>`,
    },
    {
      termsHeader: 'Miscellaneous',
      termsDescription: `<p>Seller shall not assign, transfer, delegate or subcontract any of its rights or obligations under the Order without Buyer’s prior written consent. Any purported assignment or delegation in violation of this Section shall be null and void. No assignment shall relieve the Seller of any of its obligations hereunder. No modification, alteration or amendment of the Order shall be binding unless agreed to in writing and signed by Buyer. The Buyer reserves the right to amend order or any part thereof without assigning any reason. No waiver by any party of any of the provisions of the Order shall be effective unless explicitly set forth in writing and signed by the party so waiving. No failure to exercise, or delay in exercising, any rights, remedy, power or privilege arising from the Order by Buyer shall operate or be construed as a waiver thereof, nor shall any single or partial exercise of any right, remedy, or privilege hereunder preclude any other exercise of any additional right, remedy, or privilege.</p>`,
    },
  ],
};
