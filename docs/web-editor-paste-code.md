# Servio Web Editor paste code

The shared CSS below is already present in `src/styles.css`. Paste one HTML block into the matching page using **Source Editing**. Do not include `<html>`, `<head>`, or `<body>` tags.

## Shared CSS

```css
.cms-page {
  color: #071633;
  font-family: Inter, system-ui, sans-serif;
}
.cms-hero {
  padding: 76px 24px;
  background:
    radial-gradient(900px 500px at 90% 0%, rgba(255, 122, 0, 0.1), transparent 60%),
    linear-gradient(180deg, #f7fbff, #fff);
  border-bottom: 1px solid #dfe5ef;
}
.cms-dark {
  background: linear-gradient(135deg, #071633, #174bb8);
  color: #fff;
}
.cms-wrap {
  max-width: 1180px;
  margin: auto;
}
.cms-center {
  text-align: center;
}
.cms-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
}
.cms-grid.two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.cms-grid.four {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
.cms-section {
  padding: 64px 24px;
}
.cms-soft {
  background: #f6f8fb;
}
.cms-card {
  padding: 24px;
  border: 1px solid #dfe5ef;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.06);
}
.cms-kicker {
  color: #174bb8;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.cms-hero h1 {
  font-size: clamp(38px, 5vw, 58px);
  line-height: 1.05;
}
.cms-hero p {
  max-width: 700px;
  margin: 18px auto 0;
  color: #5b667a;
  font-size: 18px;
  line-height: 1.7;
}
.cms-dark p {
  color: rgba(255, 255, 255, 0.78);
}
.cms-btn {
  display: inline-flex;
  align-items: center;
  min-height: 48px;
  margin: 24px 8px 0;
  padding: 0 22px;
  border-radius: 14px;
  background: #174bb8;
  color: #fff !important;
  font-weight: 800;
  text-decoration: none;
}
.cms-btn.orange {
  background: #ff7a00;
}
.cms-list {
  display: grid;
  gap: 12px;
  padding: 0;
  list-style: none;
}
.cms-cta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-top: 50px;
  padding: 40px;
  border-radius: 28px;
  background: #174bb8;
  color: #fff;
}
@media (max-width: 800px) {
  .cms-grid,
  .cms-grid.two,
  .cms-grid.four {
    grid-template-columns: 1fr;
  }
  .cms-cta {
    display: block;
  }
}
```

## Home Page

```html
<div class="cms-page">
  <section class="cms-hero cms-center">
    <div class="cms-wrap">
      <p class="cms-kicker">Trusted local professionals</p>
      <h1>Get any job done by the right professional</h1>
      <p>
        Post your job, compare verified professionals, hire safely, and track every step in one
        place.
      </p>
      <a class="cms-btn orange" href="/post-job">Post a job</a
      ><a class="cms-btn" href="/discover">Find professionals</a>
    </div>
  </section>
  <section class="cms-section">
    <div class="cms-wrap">
      <h2>Everything you need to hire with confidence</h2>
      <div class="cms-grid">
        <div class="cms-card">
          <h3>Post in minutes</h3>
          <p>Describe the work, budget, location, and timing.</p>
        </div>
        <div class="cms-card">
          <h3>Compare trusted pros</h3>
          <p>Review profiles, verification, ratings, and proposals.</p>
        </div>
        <div class="cms-card">
          <h3>Manage work safely</h3>
          <p>Message, track milestones, and release payment after approval.</p>
        </div>
      </div>
      <div class="cms-cta">
        <div>
          <h2>Ready to get started?</h2>
          <p>Tell us what you need and receive qualified proposals.</p>
        </div>
        <a class="cms-btn orange" href="/post-job">Post your job</a>
      </div>
    </div>
  </section>
</div>
```

## About Us

```html
<div class="cms-page">
  <section class="cms-hero cms-center">
    <div class="cms-wrap">
      <p class="cms-kicker">Company</p>
      <h1>About Servio</h1>
      <p>Servio helps clients hire trusted professionals and helps skilled workers grow.</p>
    </div>
  </section>
  <section class="cms-section">
    <div class="cms-wrap">
      <div class="cms-grid two">
        <div class="cms-card">
          <h2>Our Mission</h2>
          <p>Make hiring services simple, safe, and transparent for everyone.</p>
        </div>
        <div class="cms-card">
          <h2>Our Values</h2>
          <p>Trust, quality, transparency, and opportunity guide how Servio is built.</p>
        </div>
      </div>
    </div>
  </section>
</div>
```

## How It Works

```html
<div class="cms-page">
  <section class="cms-hero cms-center">
    <div class="cms-wrap">
      <p class="cms-kicker">Simple from start to finish</p>
      <h1>Great work, without the guesswork</h1>
      <p>
        Servio gives clients and professionals one clear process from first post to final payment.
      </p>
    </div>
  </section>
  <section class="cms-section">
    <div class="cms-wrap">
      <h2>For clients — in 4 steps</h2>
      <div class="cms-grid four">
        <div class="cms-card">
          <h3>1. Post your job</h3>
          <p>Describe the work, budget, and timeline.</p>
        </div>
        <div class="cms-card">
          <h3>2. Compare proposals</h3>
          <p>Chat, compare ratings, and shortlist professionals.</p>
        </div>
        <div class="cms-card">
          <h3>3. Hire safely</h3>
          <p>Agree on milestones and keep payment protected.</p>
        </div>
        <div class="cms-card">
          <h3>4. Pay and review</h3>
          <p>Approve the work, release payment, and leave a review.</p>
        </div>
      </div>
    </div>
  </section>
  <section class="cms-section cms-soft">
    <div class="cms-wrap">
      <h2>For professionals</h2>
      <div class="cms-grid">
        <div class="cms-card">
          <h3>Create your profile</h3>
          <p>Show your skills, portfolio, and certifications.</p>
        </div>
        <div class="cms-card">
          <h3>Send proposals</h3>
          <p>Find suitable jobs and submit clear quotes.</p>
        </div>
        <div class="cms-card">
          <h3>Deliver and grow</h3>
          <p>Complete milestones, get paid, and build your reputation.</p>
        </div>
      </div>
    </div>
  </section>
</div>
```

## Services / Categories

```html
<div class="cms-page">
  <section class="cms-hero cms-center">
    <div class="cms-wrap">
      <p class="cms-kicker">Explore services</p>
      <h1>Browse all services</h1>
      <p>
        From urgent home repairs to long-term business support, find the right professional for your
        project.
      </p>
      <a class="cms-btn" href="/discover">Browse professionals</a>
    </div>
  </section>
  <section class="cms-section">
    <div class="cms-wrap">
      <div class="cms-grid four">
        <div class="cms-card">
          <h3>Home & Repairs</h3>
          <p>Plumbing, electrical work, cleaning, painting, and maintenance.</p>
        </div>
        <div class="cms-card">
          <h3>Business Services</h3>
          <p>Accounting, legal support, consulting, and administration.</p>
        </div>
        <div class="cms-card">
          <h3>Technology</h3>
          <p>Web development, design, IT support, and digital marketing.</p>
        </div>
        <div class="cms-card">
          <h3>Events & Lifestyle</h3>
          <p>Photography, catering, beauty, fitness, and personal services.</p>
        </div>
      </div>
    </div>
  </section>
</div>
```

## For Clients

```html
<div class="cms-page">
  <section class="cms-hero">
    <div class="cms-wrap">
      <p class="cms-kicker">For clients</p>
      <h1>Hire trusted pros — without the back-and-forth</h1>
      <p>Post once. Get qualified proposals fast. Pay only when work is done.</p>
      <a class="cms-btn orange" href="/post-job">Post a job — it’s free</a
      ><a class="cms-btn" href="/discover">Browse pros</a>
    </div>
  </section>
  <section class="cms-section">
    <div class="cms-wrap">
      <h2>Why clients choose Servio</h2>
      <div class="cms-grid four">
        <div class="cms-card">
          <h3>Vetted professionals</h3>
          <p>Review verification, experience, and ratings.</p>
        </div>
        <div class="cms-card">
          <h3>Protected payments</h3>
          <p>Release funds when approved work is complete.</p>
        </div>
        <div class="cms-card">
          <h3>Fast matches</h3>
          <p>Receive and compare proposals in one place.</p>
        </div>
        <div class="cms-card">
          <h3>Helpful support</h3>
          <p>Get assistance whenever your project needs it.</p>
        </div>
      </div>
    </div>
  </section>
</div>
```

## For Professionals

```html
<div class="cms-page">
  <section class="cms-hero cms-dark">
    <div class="cms-wrap">
      <p class="cms-kicker">For professionals</p>
      <h1>Find quality jobs. Get paid safely. Grow your business.</h1>
      <p>
        Build your profile, connect with serious clients, and manage your work from one platform.
      </p>
      <a class="cms-btn orange" href="/signup">Join as a professional</a>
    </div>
  </section>
  <section class="cms-section">
    <div class="cms-wrap">
      <h2>Built for professionals like you</h2>
      <div class="cms-grid">
        <div class="cms-card">
          <h3>Quality opportunities</h3>
          <p>Discover jobs that match your skills, availability, and service area.</p>
        </div>
        <div class="cms-card">
          <h3>A profile that sells</h3>
          <p>Showcase work photos, certifications, reviews, and pricing.</p>
        </div>
        <div class="cms-card">
          <h3>Simple project tools</h3>
          <p>Send proposals, message clients, track work, and view earnings.</p>
        </div>
      </div>
    </div>
  </section>
</div>
```

## Pricing

```html
<div class="cms-page">
  <section class="cms-hero cms-center">
    <div class="cms-wrap">
      <p class="cms-kicker">Clear and fair</p>
      <h1>Simple, transparent pricing</h1>
      <p>Join free. See costs clearly before you hire or accept work.</p>
    </div>
  </section>
  <section class="cms-section">
    <div class="cms-wrap">
      <div class="cms-grid two">
        <div class="cms-card">
          <h2>For clients</h2>
          <h3>Free to post jobs</h3>
          <ul class="cms-list">
            <li>✓ Compare proposals</li>
            <li>✓ Message professionals</li>
            <li>✓ Track project milestones</li>
            <li>✓ Review costs before payment</li>
          </ul>
          <a class="cms-btn" href="/post-job">Post a job</a>
        </div>
        <div class="cms-card">
          <h2>For professionals</h2>
          <h3>Free to create a profile</h3>
          <ul class="cms-list">
            <li>✓ Browse suitable jobs</li>
            <li>✓ Send proposals</li>
            <li>✓ Build reviews and reputation</li>
            <li>✓ View fees before accepting work</li>
          </ul>
          <a class="cms-btn orange" href="/signup">Join Servio</a>
        </div>
      </div>
    </div>
  </section>
</div>
```

## FAQ

```html
<div class="cms-page">
  <section class="cms-hero cms-center">
    <div class="cms-wrap">
      <p class="cms-kicker">Help center</p>
      <h1>Frequently asked questions</h1>
      <p>Quick answers about hiring, projects, payments, and professional accounts.</p>
    </div>
  </section>
  <section class="cms-section">
    <div class="cms-wrap">
      <div class="cms-card">
        <h2>How do I hire a professional?</h2>
        <p>
          Post a job or browse professionals, compare profiles and proposals, then choose the best
          match.
        </p>
        <h2>Is posting a job free?</h2>
        <p>
          Yes. You can post your requirements and review proposals before making a hiring decision.
        </p>
        <h2>How are professionals verified?</h2>
        <p>
          Professionals can submit identity, license, insurance, and certification documents for
          review.
        </p>
        <h2>How do payments work?</h2>
        <p>
          Project costs and milestones are agreed before work begins. Payment is released after
          approval.
        </p>
        <h2>Can I message before hiring?</h2>
        <p>Yes. Use Servio messaging to clarify scope, timing, and price.</p>
      </div>
    </div>
  </section>
</div>
```

## Contact Us

```html
<div class="cms-page">
  <section class="cms-hero cms-center">
    <div class="cms-wrap">
      <p class="cms-kicker">Support</p>
      <h1>Contact Us</h1>
      <p>We would love to hear from you.</p>
    </div>
  </section>
  <section class="cms-section">
    <div class="cms-wrap">
      <div class="cms-grid">
        <div class="cms-card">
          <h2>Email</h2>
          <p><a href="mailto:support@servio.com">support@servio.com</a></p>
        </div>
        <div class="cms-card">
          <h2>Office</h2>
          <p>123 Market Street, San Francisco</p>
        </div>
        <div class="cms-card">
          <h2>Hours</h2>
          <p>Monday to Friday, 9 AM to 6 PM</p>
        </div>
      </div>
    </div>
  </section>
</div>
```

## Privacy Policy

```html
<div class="cms-page">
  <section class="cms-hero cms-center">
    <div class="cms-wrap">
      <p class="cms-kicker">Legal</p>
      <h1>Privacy Policy</h1>
      <p>How Servio collects, uses, and protects your information.</p>
    </div>
  </section>
  <section class="cms-section">
    <div class="cms-wrap">
      <div class="cms-card">
        <h2>Information We Collect</h2>
        <p>
          We collect account, contact, profile, usage, project, and transaction information needed
          to provide Servio services.
        </p>
        <h2>How We Use It</h2>
        <p>
          We use information to operate the platform, process requests, improve safety, communicate
          with users, and provide support.
        </p>
        <h2>How We Protect It</h2>
        <p>
          We use reasonable technical and organizational safeguards to protect personal information.
        </p>
        <h2>Your Choices</h2>
        <p>
          You can update account information and contact support about access, correction, or
          deletion requests.
        </p>
      </div>
    </div>
  </section>
</div>
```

## Terms & Conditions

```html
<div class="cms-page">
  <section class="cms-hero cms-center">
    <div class="cms-wrap">
      <p class="cms-kicker">Legal</p>
      <h1>Terms & Conditions</h1>
      <p>The rules that help keep Servio safe, fair, and reliable.</p>
    </div>
  </section>
  <section class="cms-section">
    <div class="cms-wrap">
      <div class="cms-card">
        <h2>Acceptance of Terms</h2>
        <p>By accessing or using Servio, you agree to follow these terms and applicable laws.</p>
        <h2>User Accounts</h2>
        <p>
          You are responsible for accurate account information, your credentials, and activity
          performed through your account.
        </p>
        <h2>Services and Agreements</h2>
        <p>
          Clients and professionals are responsible for defining project scope, timing,
          deliverables, and price.
        </p>
        <h2>Payments</h2>
        <p>
          Users must follow the displayed payment process, fees, refund rules, and milestone
          approvals.
        </p>
        <h2>Acceptable Use</h2>
        <p>
          Do not misuse the platform, misrepresent information, violate rights, or attempt
          unauthorized access.
        </p>
      </div>
    </div>
  </section>
</div>
```
