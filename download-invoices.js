#!/usr/bin/env node

require("dotenv").config();
const fs = require("fs");
const puppeteer = require("puppeteer");
const args = process.argv.slice(2);
const mkdirp = require("mkdirp");
const path = require("path");
const request = require("request-promise-native");

const { LOGIN_USER, LOGIN_PASS } = process.env;

// Shout out to https://stackoverflow.com/questions/25945714/how-to-download-pdf-file-from-url-in-node-js for this.
async function downloadPDF(pdfURL, outputFilename) {
	let pdfBuffer = await request.get({ uri: pdfURL, encoding: null });
	console.log("Writing downloaded PDF file to " + outputFilename + "...");
	fs.writeFileSync(outputFilename, pdfBuffer);
}

const filePath = args[0];
if (!filePath) {
	console.error("Please provide a file path as first argument");
	process.exit();
}
let urls = [];
try {
	const fileContents = fs.readFileSync(filePath, {
		encoding: "utf8",
		flag: "r"
	});
	urls = fileContents.split(/\r?\n/);
} catch (e) {
	console.log(`Could not open file: ${filePath}`);
	console.log(e);
	process.exit();
}

console.log("urls extracted:");
console.log(urls);

try {
	// Ensure output directory is created.
	mkdirp.sync(path.resolve(__dirname, "./output"));
} catch (e) {
	console.log(`Could not create output directory.`);
	console.log(e);
	process.exit();
}

(async () => {
	const browser = await puppeteer.launch({
		headless: false
	});
	const page = await browser.newPage();
	await page.goto("https://app.hellobonsai.com");
	await page.$eval(
		"#login-user-email",
		(el, loginUser) => (el.value = loginUser),
		LOGIN_USER
	);
	await page.$eval(
		"#login-user-password",
		(el, loginPass) => (el.value = loginPass),
		LOGIN_PASS
	);
	await page.$eval("#login_form", (el) => el.submit());
	await page.waitForSelector(".dashboard-chart-container", { visible: true });
	for (let i = 0; i < urls.length; i++) {
		await page.goto(urls[i]);

		// Click Download PDF
		await page.$eval('[data-target="#modal-pdf-download"]', (el) => el.click());

		// Await Download Button to show.
		await page.waitForSelector(
			'[data-react-class="PdfDownloadModalContainer"] a.btn-primary[href]',
			{
				visible: true,
				hidden: false
			}
		);

		// Click Download Button.
		const documentUrl = await page.$eval(
			'[data-react-class="PdfDownloadModalContainer"] a.btn-primary[href]',
			(el) => el.getAttribute("href")
		);
		await downloadPDF(
			documentUrl,
			path.resolve(__dirname, `./output/${path.basename(documentUrl)}`)
		);
	}

	console.log("Invoice download complete!");
	browser.close();
})();
