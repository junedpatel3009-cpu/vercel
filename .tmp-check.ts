import { getOpenClientJobs } from "./src/lib/job-db.server";
import { getProfessionalUsers } from "./src/lib/user-db.server";
import { getProfessionalVerificationByUserId } from "./src/lib/pro-verification-db.server";
import { getUserProjectTransactions } from "./src/lib/project-request-db.server";
import { getServiceCategories } from "./src/lib/services-db.server";

const openJobs = getOpenClientJobs();
const professionals = getProfessionalUsers();
const verification = getProfessionalVerificationByUserId(1);
const transactions = getUserProjectTransactions(1);
const categories = getServiceCategories();

const job = openJobs[0];
const pro = professionals[0];
const tx = transactions[0];
const cat = categories[0];

void job;
void pro;
void tx;
void cat;
void verification;
