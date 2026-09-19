const projects = {
  observability: {
    kicker: "01 · AGENTIC AI",
    title: "Autonomous AI Observability",
    lead: "A production-grade AI-powered observability platform using multi-agent AI for automated log analysis, debugging and AI-assisted root-cause analysis across distributed services.",
    role: "AI Product Owner / Solution Architect / Delivery Lead",
    problem: "Operational teams need to investigate distributed-service incidents across logs and telemetry. The product was designed to centralize the evidence and use AI agents to accelerate incident investigation and remediation workflows.",
    product: "Real-time monitoring, centralized logging, telemetry analysis, trace correlation and AI-assisted incident investigation.",
    approach: [
      "Defined product requirements and workflows for monitoring, incident investigation and remediation.",
      "Coordinated AI and web development teams across Python, FastAPI, Google Cloud and agent components.",
      "Defined agent responsibilities, workflow logic, system interactions, technical requirements and delivery priorities.",
      "Integrated Google Cloud Logs, Pub/Sub and Cloud Trace with OpenTelemetry for end-to-end trace correlation."
    ],
    stack: "Python · FastAPI · Google Cloud Logs · Pub/Sub · Cloud Trace · IAM · OpenTelemetry · Google ADK · Gemini · Claude · Docker · Bitbucket",
    productThinking: "The product direction includes clear human escalation, confidence-aware review, incident deduplication, service criticality policies, AI cost visibility and operational dashboard improvements. These are product/safety considerations rather than simply model choices."
  },
  agents: {
    kicker: "02 · AI PRODUCT",
    title: "AI Agents Platform",
    lead: "An AI-driven productivity platform for healthcare operations, combining workflow design, web applications and AI-enabled capabilities.",
    role: "Product Owner / Solution Architect",
    problem: "Operational workflows needed to be translated into usable client-facing AI-enabled products with clear user journeys, business rules and acceptance criteria.",
    product: "An AI Agents Portal supporting operational automation and productivity use cases.",
    approach: [
      "Defined product workflows, user journeys, business logic, functional requirements and acceptance criteria.",
      "Coordinated AI and web development teams to translate operational workflows into product modules.",
      "Supported scalability and delivery planning across multiple connected capabilities.",
      "Product modules included Template Management, Wallboard Creation, Assembly & Distribution, Wallboard Editor, QR Code Generator, Drug Competitor Analysis and Conference Data Analysis."
    ],
    stack: "AI Agents · Web Applications · Product Workflows · Requirements · UAT · Stakeholder Management",
    productThinking: "The portfolio framing emphasizes the product-owner responsibilities: turning business workflows into a coherent product, defining requirements and coordinating delivery rather than presenting the work as a collection of disconnected technical features."
  },
  drug: {
    kicker: "03 · AI / ML",
    title: "Drug Competitor Intelligence",
    lead: "A data-driven AI/ML solution for identifying and ranking competitor drugs using similarity modeling and enriched healthcare datasets.",
    role: "Product / Solution Delivery Lead",
    problem: "Healthcare and market-intelligence workflows required a repeatable way to process large drug datasets and identify products with similar attributes or text characteristics.",
    product: "A pipeline and similarity-based intelligence workflow that ingests, prepares and ranks candidate competitor drugs.",
    approach: [
      "Defined product requirements and analytical workflows for ingestion, transformation, feature engineering and competitor identification.",
      "Designed scalable ETL workflows for large healthcare/drug datasets.",
      "Applied attribute-based and text-based similarity techniques to identify and rank closest competitor drugs.",
      "Worked with engineering and data teams to translate business requirements into scalable data-processing and similarity-modeling workflows."
    ],
    stack: "Python · Pandas · NumPy · Scikit-learn · Google BigQuery · ETL Pipelines · Similarity Modeling · Data Engineering",
    productThinking: "The key product decision is to make similarity useful to a business user: define what constitutes a meaningful competitor, prepare consistent signals, rank results and expose the workflow in a way that supports market intelligence."
  },
  recommendation: {
    kicker: "04 · ML PRODUCT",
    title: "Content Recommendation Engine",
    lead: "A personalized content recommendation engine for healthcare professionals using site interactions, specialty and location signals.",
    role: "Product / Analytics / ML Delivery",
    problem: "Healthcare professionals need specialized content that matches their interests, professional specialty and the content demanded in their location.",
    product: "A recommendation workflow using interaction data and machine learning to provide relevant content to creators who then build specialized wallboards.",
    approach: [
      "Collected site interaction data from GA4, production MySQL and healthcare-professional specialty/location data.",
      "Built cleaned and feature-rich datasets for the machine-learning workflow.",
      "Used collaborative filtering and content-based filtering to predict relevant content.",
      "Integrated a feedback loop so user ratings could contribute to continuous model improvement.",
      "Supported a React interface and Node.js backend for creators interacting with recommendations."
    ],
    stack: "Python · Collaborative Filtering · Content-Based Filtering · GA4 · MySQL · React · Node.js",
    productThinking: "The product loop is data → recommendation → creator workflow → user feedback → improved recommendations, making the ML model part of a larger product system rather than the product by itself."
  },
  abrams: {
    kicker: "05 · DATA + BI MODERNIZATION",
    title: "Enterprise BI & Data Modernization",
    lead: "A large-scale modernization program that redesigned a fragmented publishing BI ecosystem around Google Cloud, BigQuery, Power BI and a centralized business portal.",
    role: "Project / Product Lead · Data & Solution Architecture",
    problem: "The legacy landscape used disconnected Talend ETL, Snowflake, Qlik Sense and manual Excel processes, creating duplicated business logic, maintenance complexity, limited scalability and inconsistent reporting.",
    product: "A unified cloud-native data and analytics ecosystem with centralized warehousing, reporting, operational applications, user administration and governance.",
    approach: [
      "Migrated 200+ ETL pipelines from Talend to cloud-native Google Cloud workflows and orchestration.",
      "Established BigQuery as the centralized enterprise data warehouse and standardized business logic.",
      "Introduced Power BI Embedded with Row-Level Security and a centralized Abrams BI Portal.",
      "Integrated custom React.js, Node.js and Python applications with reporting and operational workflows.",
      "Established data validation, reconciliation, regression testing and UAT practices before production.",
      "Implemented cloud scheduling, monitoring, IAM/service accounts and production support practices."
    ],
    stack: "Google Cloud · BigQuery · Cloud Storage · Airflow · Power BI Embedded · RLS · React.js · Node.js · Python · Talend · Snowflake · Qlik · NetSuite",
    productThinking: "The modernization treated BI as an enterprise product: users needed one entry point, governed access, trusted data, operational workflows and a consistent reporting experience — not simply a new ETL platform.",
    image: "assets/abrams-architecture.png"
  }
};

const modal = document.getElementById("projectModal");
const content = document.getElementById("modalContent");

function openProject(key){
  const p = projects[key];
  if(!p) return;
  content.innerHTML = `
    <div class="modal-kicker">${p.kicker}</div>
    <h2 id="modalTitle">${p.title}</h2>
    <p class="modal-lead">${p.lead}</p>
    <div class="modal-grid">
      <div class="modal-block"><h4>MY ROLE</h4><p>${p.role}</p></div>
      <div class="modal-block"><h4>PRODUCT</h4><p>${p.product}</p></div>
      <div class="modal-block"><h4>BUSINESS / OPERATIONAL PROBLEM</h4><p>${p.problem}</p></div>
      <div class="modal-block"><h4>TECHNOLOGY</h4><p>${p.stack}</p></div>
    </div>
    <div class="modal-block modal-full">
      <h4>WHAT I DROVE</h4>
      <ul>${p.approach.map(x => `<li>${x}</li>`).join("")}</ul>
    </div>
    <div class="modal-block modal-full">
      <h4>PRODUCT THINKING</h4>
      <p>${p.productThinking}</p>
    </div>
    ${p.image ? `<div class="modal-block modal-full"><h4>REFERENCE ARCHITECTURE</h4><img class="architecture-image" src="${p.image}" alt="Enterprise BI platform architecture"></div>` : ""}
    <div class="modal-note">Portfolio note: this case study is based on project material supplied by Rakesh. No unsupported performance numbers or confidential client data have been added.</div>
  `;
  modal.classList.add("open");
  modal.setAttribute("aria-hidden","false");
  document.body.style.overflow="hidden";
}

function closeModal(){
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden","true");
  document.body.style.overflow="";
}

document.querySelectorAll("[data-project]").forEach(card => {
  card.addEventListener("click", (e) => {
    if(e.target.closest("button") || e.currentTarget === card) openProject(card.dataset.project);
  });
});
document.querySelectorAll("[data-close]").forEach(el => el.addEventListener("click", closeModal));
document.addEventListener("keydown", e => { if(e.key === "Escape") closeModal(); });
document.getElementById("year").textContent = new Date().getFullYear();
