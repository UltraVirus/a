# ██╗░░░░░██╗██████╗░██████╗░░█████╗░██████╗░██╗███████╗░██████╗
# ██║░░░░░██║██╔══██╗██╔══██╗██╔══██╗██╔══██╗██║██╔════╝██╔════╝
# ██║░░░░░██║██████╦╝██████╔╝███████║██████╔╝██║█████╗░░╚█████╗░
# ██║░░░░░██║██╔══██╗██╔══██╗██╔══██║██╔══██╗██║██╔══╝░░░╚═══██╗
# ███████╗██║██████╦╝██║░░██║██║░░██║██║░░██║██║███████╗██████╔╝
# ╚══════╝╚═╝╚═════╝░╚═╝░░╚═╝╚═╝░░╚═╝╚═╝░░╚═╝╚═╝╚══════╝╚═════╝░
# https://api-xbll.onrender.com
from fastapi import FastAPI, UploadFile, File, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import PlainTextResponse
from argon2 import PasswordHasher
from PIL import Image
from pathlib import Path
import base64, json, http.client, uvicorn, asyncio, secrets, dataset, io, os, time, asyncio, re, socket, ssl
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography import x509
from cryptography.hazmat.backends import default_backend



# ██╗░░░██╗░█████╗░██████╗░██╗░█████╗░██████╗░██╗░░░░░███████╗░██████╗
# ██║░░░██║██╔══██╗██╔══██╗██║██╔══██╗██╔══██╗██║░░░░░██╔════╝██╔════╝
# ╚██╗░██╔╝███████║██████╔╝██║███████║██████╦╝██║░░░░░█████╗░░╚█████╗░
# ░╚████╔╝░██╔══██║██╔══██╗██║██╔══██║██╔══██╗██║░░░░░██╔══╝░░░╚═══██╗
# ░░╚██╔╝░░██║░░██║██║░░██║██║██║░░██║██████╦╝███████╗███████╗██████╔╝
# ░░░╚═╝░░░╚═╝░░╚═╝╚═╝░░╚═╝╚═╝╚═╝░░╚═╝╚═════╝░╚══════╝╚══════╝╚═════╝░
print("Current working directory:", os.getcwd())
app = FastAPI()
password_hasher = PasswordHasher()
file_lock = asyncio.Lock()
api_key = os.getenv("open_ai_key")
webhook_id = os.getenv("paypal_webhook_id")
paypal_client_id = os.getenv("paypal_client_id")
paypal_secret_key = os.getenv("paypal_secret_key")
prompt = open("api/prompt.txt").read().strip().replace("\n", "\\n")
verification_codes = {} # {"12345": "email@gmail.com"}
image_id = int(len(os.listdir("database/images")) * 0.5)
database_file = dataset.connect("sqlite:///database/packstorm.db")
accounts = database_file["accounts"]
cards = database_file["cards"]
tokens = database_file["tokens"]
verification_lock = asyncio.Lock()
paypal_certificate = None
paypal_certificate_expiration = 0
paypal_access_token = None
paypal_access_token_expiration = 0

app.add_middleware(
	CORSMiddleware,
	allow_origins = ["https://a-1gdp.onrender.com"], # or ["*"] to allow all
	allow_credentials = True,
	allow_methods = ["*"],
	allow_headers = ["*"]
)

app.mount("/images", StaticFiles(directory="database/images"), name="images")

def compress(image_bytes):

	image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

	if len(image_bytes) < 150000:
		return base64.b64encode(image_bytes).decode()
	
	image.thumbnail((1500, 1500))

	image = image.convert("RGB")
	buf = io.BytesIO()
	image.save(buf, format="WEBP", quality=50)

	return base64.b64encode(buf.getvalue()).decode()

default_response = {
	"name": str,
	"series": str,
	"foil_effect": str,
	"parallel": (int, float),
	"estimated_price": (int, float),
	"score": (int, float),
	"image_quality": (bool, type(None))
}

def clean_ai_response(ai_response_dict):

	if isinstance(ai_response_dict, dict) == False:
		return False, None

	
	cleaned_response = {}
	
	for expected_key, expected_type in default_response.items():

		ai_response_value = ai_response_dict.get(expected_key) # This a value inside the dict that the ai filled out

		if isinstance(ai_response_value, expected_type) == True:
			
			if isinstance(ai_response_value, str) == True:
				
				if len(ai_response_value) > 2:
					cleaned_response[expected_key] = ai_response_value
				elif expected_key == "name":
					return False, None
				
			else:
				
				cleaned_response[expected_key] = ai_response_value
				
		elif expected_key == "name":
			return False, None
	
	
	image_quality = cleaned_response.pop("image_quality", None)
	
	print(cleaned_response)
	
	return cleaned_response, image_quality

def get_format(b):
	header = b[:12]
	if header.startswith(b"\x89PNG"):
		return "png"
	if header.startswith(b"\xff\xd8"):
		return "jpeg"
	if header[:4] == b"RIFF" and header[8:12] == b"WEBP":
		return "webp"
	return None

def convert_to_png(b):
	img = Image.open(io.BytesIO(b))
	o = io.BytesIO()
	img.save(o, "PNG")
	return o.getvalue()
	
def is_valid_email(email):
	return bool(re.fullmatch(
		r"(?!.*@.*@)(?!\.)(?!.*\.\.)[A-Za-z0-9._+\-!#$%&'*\/=?^_`{}|~]{1,64}(?<!@)(?<!\.)@"
		r"(?:(?!-)[A-Za-z0-9\-]{1,63}(?<!-)\.)+[A-Za-z]{2,63}", email
	)) and len(email) <= 254

def get_request(host, path):
	A=ssl.create_default_context().wrap_socket(socket.socket(),server_hostname=host)
	A.connect((host,443))
	A.sendall(f"GET {path} HTTP/1.1\r\nHost:{host}\r\n\r\n".encode())
	B=A.recv(2097152)
	A.close()
	return B.split(b"\r\n\r\n", 1)[1].decode()

def post_request(host, path, body, header):
	A=ssl.create_default_context().wrap_socket(socket.socket(),server_hostname=host)
	A.connect((host,443))
	A.sendall(f"POST {path} HTTP/1.0\r\nHost:{host}\r\n"+"".join(f"{C}:{D}\r\n"for C,D in header.items())+f"Content-Length:{len(body)}\r\n\r\n{body}".encode())
	B=A.recv(2097152)
	A.close()
	return B.split(b"\r\n\r\n", 1)[1].decode()



# ███████╗███╗░░██╗██████╗░██████╗░░█████╗░██╗███╗░░██╗████████╗░██████╗
# ██╔════╝████╗░██║██╔══██╗██╔══██╗██╔══██╗██║████╗░██║╚══██╔══╝██╔════╝
# █████╗░░██╔██╗██║██║░░██║██████╔╝██║░░██║██║██╔██╗██║░░░██║░░░╚█████╗░
# ██╔══╝░░██║╚████║██║░░██║██╔═══╝░██║░░██║██║██║╚████║░░░██║░░░░╚═══██╗
# ███████╗██║░╚███║██████╔╝██║░░░░░╚█████╔╝██║██║░╚███║░░░██║░░░██████╔╝
# ╚══════╝╚═╝░░╚══╝╚═════╝░╚═╝░░░░░░╚════╝░╚═╝╚═╝░░╚══╝░░░╚═╝░░░╚═════╝░

@app.post("/webhook")

async def paypal_webhook(request: Request):
	global paypal_access_token
	global paypal_access_token_expiration
	
	try:
		body = await request.body()
	except:
		pass
	
	event = json.loads(body)
	subscription_id = event.get("resource").get("id")
	
	if subscription_id == None:
		return Response(status_code=200)
	
	account = accounts.find_one(subscription_id = subscription_id)
	
	if account == None:
		return Response(status_code=200)
	
	certificate_url = request.headers.get("PAYPAL-CERT-URL")
	print(certificate_url)
	if certificate_url == None:
		return Response(status_code=200)
	
	# Verify request #
	
	# Get access token if expired
	current_timestamp = time.time()
	
	if paypal_access_token == None or current_timestamp > paypal_access_token_expiration:
		print("yes")
		try:
			response = json.loads(post_request("api-m.sandbox.paypal.com", "/v1/oauth2/token", "grant_type=client_credentials", {"Authorization": f"Basic {base64.b64encode(f"{paypal_client_id}:{paypal_secret_key}".encode()).decode()}", "Content-Type": "application/x-www-form-urlencoded"}))
			token = response["access_token"]
			paypal_access_token_expiration = current_timestamp + response.get("expires_in") - 60
		except:
			return Response(status_code=200)
	
	
	current_timestamp = time.time()
	
	if paypal_certificate == None or current_timestamp > paypal_certificate_expiration:
		print("yes 2")
		try:
			
			new_certificate = x509.load_pem_x509_certificate(get_request(certificate_url.replace("https://", "").split("/", 1)[0],"/" + certificate_url.replace("https://", "").split("/", 1)[1]).encode())
			print(new_certificate)
			paypal_certificate = new_certificate
			paypal_certificate_expiration = new_certificate.not_valid_after.timestamp() - 600
			
		except Exception as e:
			print("Error fetching PayPal cert:", e)
			return Response(status_code=200)
	
	# Verify signature
	signature_bytes = base64.b64decode(request.headers.get("PAYPAL-TRANSMISSION-SIG"))
	
	try:
		paypal_certificate.public_key().verify(
			signature_bytes,
			f'{request.headers.get("PAYPAL-TRANSMISSION-ID")}|{request.headers.get("PAYPAL-TRANSMISSION-TIME")}|{webhook_id}|'.encode() + body,
			padding.PKCS1v15(),
			hashes.SHA256()
		)
	except Exception:
		print("Signature verification failed")
		return Response(status_code=200)
	

	
	## ----------------------------------------------------------------------------------------------------
	
	
	
	
	
	event_type = event.get("event_type")
	
	
	if event_type == "BILLING.SUBSCRIPTION.CANCELLED" or event_type == "BILLING.SUBSCRIPTION.EXPIRED" or event_type == "BILLING.SUBSCRIPTION.SUSPENDED":
		
		await asyncio.to_thread(lambda: accounts.update({"subscription_id": subscription_id}, {"subscription_id": None, "subscription_type": None, "subscription_timestamp": None}, ["subscription_id"]) )
		
	elif event_type == "BILLING.SUBSCRIPTION.ACTIVATED" or event_type == "BILLING.SUBSCRIPTION.RE-ACTIVATED":
		
		await asyncio.to_thread(lambda: accounts.update({"subscription_id": subscription_id}, {"subscription_timestamp": int(time.time())}, ["subscription_id"]) )
	
	return Response(status_code=200)
	


@app.get("/collection")

async def get_collection(request: Request, response: Response, search: str = "",series: str = "",min_price: int = 0,max_price: int = 999999,offset: int = 0,limit: int = 40):
	
	# Check if user is logged into valid account
	token = request.cookies.get("token")
	
	if token == None:
		return Response(status_code=410)
	
	account_token_data = tokens.find_one(token = token)
	
	if account_token_data == None or account_token_data["email"] == None:
		return Response(status_code=410)
	
	account = accounts.find_one(email = account_token_data["email"])
	
	if account == None:
		return Response(status_code=410)
	
	
	collection_ids = account.get("collection")
	
	if collection_ids == None:
		return Response(status_code=200)


	collection_cards = [dict(cards.find_one(id=card_id)) for card_id in collection_ids]

	filtered = [
		card for card in collection_cards
		if (search == "" or search in card.get("name", "")) and
		   (series == "" or series in card.get("series", "")) and
		   (card.get("estimated_price") is None or min_price <= card.get("estimated_price", 0) <= max_price)
	]

	results = filtered[offset:offset + limit]

	for card in results:
		
		card.pop("id", None)
		
		if card.get("image_1_path"):
			card["image_1_url"] = f"/images/{os.path.basename(card['image_1_path'])}"
		if card.get("image_2_path"):
			card["image_2_url"] = f"/images/{os.path.basename(card['image_2_path'])}"

	return results


@app.put("/forgot_password") # Remember for this endpoint: before this gets runned the user will login with their email code instead of the password. So this request can only be done while logged in.

async def forgot_password(request: Request):
	
	try:
		new_password = await request.body().decode()
	except:
		return Response(status_code=410)
	
	# Check if user is logged into valid account
	token = request.cookies.get("token")
	
	if token == None:
		return Response(status_code=410)
	
	account_token_data = tokens.find_one(token = token)
	
	if account_token_data == None or account_token_data["email"] == None:
		return Response(status_code=410)
	
	account = accounts.find_one(email = account_token_data["email"])
	
	if account == None:
		return Response(status_code=410)
	


	new_hashed_password = password_hasher.hash(new_password)
	
	await asyncio.to_thread(lambda: accounts.update({"email": account_token_data["email"], "hashed_password": new_hashed_password}, ["email"]) )

	return Response(status_code=200)


@app.put("/change_password")

async def change_password(request: Request):
	
	body = await request.body()
	
	try:
		password, new_password = body.split(b",", 1)
		password = password.decode()
		new_password = new_password.decode()
	except:
		return Response(status_code=410)
	
	# Check if user is logged into valid account
	token = request.cookies.get("token")
	
	if token == None:
		return Response(status_code=410)
	
	account_token_data = tokens.find_one(token = token)
	
	if account_token_data == None or account_token_data["email"] == None:
		return Response(status_code=410)
	
	account = accounts.find_one(email = account_token_data["email"])
	
	if account == None:
		return Response(status_code=410)
	

	try:
		password_hasher.verify(account["hashed_password"], password)
	except:
		return Response(status_code=410)


	new_hashed_password = password_hasher.hash(new_password)
	
	await asyncio.to_thread(lambda: accounts.update({"email": account_token_data["email"], "hashed_password": new_hashed_password}, ["email"]) )

	return Response(status_code=200)


@app.put("/change_email")

async def change_email(request: Request):
	
	body = await request.body()
	
	try:

		password, new_email = body.split(b",", 1)
		password = password.decode()
		new_email = new_email.decode()

	except:
		return Response(status_code=410)

	# Check if user is logged into valid account
	token = request.cookies.get("token")
	
	if token == None:
		return Response(status_code=410)
	
	account_token_data = tokens.find_one(token = token)
	
	if account_token_data == None or account_token_data["email"] == None:
		return Response(status_code=410)
	
	account = accounts.find_one(email = account_token_data["email"])
	
	if account == None:
		return Response(status_code=410)
	
	
	try:
		password_hasher.verify(account["hashed_password"], password)
	except:
		return Response(status_code=410)

	if accounts.find_one(email = new_email) == None:
		return Response(status_code=410)

	
	await asyncio.to_thread(lambda: accounts.update({"email": new_email}, ["email"], where={"email": account_token_data["email"]}) )

	for row in tokens.find(email = account_token_data["email"]):
		await asyncio.to_thread(lambda: tokens.update({"id": row["id"], "email": new_email}, ["id"]) )

	return Response(status_code=200)


@app.put("/subscription")

async def verify_subscription(request: Request): # TODO Add account logged in and token check, add cleint and secret key directly with based64 already encoded

	# Check if user is logged into valid account
	token = request.cookies.get("token")
	
	if token == None:
		return Response(status_code=410)
	
	account_token_data = tokens.find_one(token = token)
	
	if account_token_data == None or account_token_data["email"] == None:
		return Response(status_code=410)
	
	account = accounts.find_one(email = account_token_data["email"])
	
	if account == None:
		return Response(status_code=410)
	
	
	try:
		# Get paypal access token
		
		connection = http.client.HTTPSConnection("api-m.sandbox.paypal.com")
		connection.request(
			"POST",
			"/v1/oauth2/token",
			"grant_type=client_credentials",
			{"Authorization": f"Basic {base64.b64encode(f"{open("C:\\Users\\xzock\\Documents\\Code\\packstorm_webapp\\api\\client_id.txt").read().strip()}:{open("C:\\Users\\xzock\\Documents\\Code\\packstorm_webapp\\api\\secret_key.txt").read().strip()}".encode()).decode()}", "Content-Type": "application/x-www-form-urlencoded"}
		)
		
		token = json.loads(connection.getresponse().read())["access_token"]
		
	except:
		return Response(status_code=410)
	
	
	subscription_id = (await request.body()).decode()
	
	if subscription_id == None or isinstance(subscription_id, str) == False:
		return Response(status_code=410)
	
	subscription_status = None
	
	try:
		# Check if subscription is active
		
		connection = http.client.HTTPSConnection("api-m.sandbox.paypal.com")
		connection.request(
			"GET",
			f"/v1/billing/subscriptions/{subscription_id}",
			headers={"Authorization": f"Bearer {token}"}
		)
		
		subscription_info = json.loads(connection.getresponse().read().decode())
		
		subscription_status = subscription_info.get("status", "")
		
	except:
		return Response(status_code=410)
	
	
	if (subscription_status == "ACTIVE") == False:
		return Response(status_code=410)
	
	if subscription_info["plan_id"] == "P-18R598326J033122JNES35JI":
		subscription_type = "1"
	elif subscription_info["plan_id"] == "P-XYZPROPLANID":
		subscription_type = "2"
	elif subscription_info["plan_id"] == "P-ABCPREMIUMID":
		subscription_type = "3"
	
	
	previous_subscription_id = account.get("subscription_id")
	
	if previous_subscription_id != None and previous_subscription_id != subscription_id:
		
		try:
			# Update subscription
			
			connection = http.client.HTTPSConnection("api-m.sandbox.paypal.com")
			connection.request(
				"PATCH",
				f"/v1/billing/subscriptions/{previous_subscription_id}",
				body='[{"op":"replace","path":"/plan_id","value":"' + subscription_info["plan_id"] + '"}]',
				headers='{"Authorization":"Bearer ' + token + '","Content-Type":"application/json"}'
			)
			
		except:
			pass
	else:
		await asyncio.to_thread(lambda: accounts.update( {"email": account_token_data["email"], "subscription_id": subscription_id, "subscription_timestamp": int(time.time()), "subscription_type": subscription_type }, ["email"]) )

	return PlainTextResponse(subscription_type)


@app.put("/analyze")

async def analyze(request: Request, image_1: UploadFile = File(None), image_2: UploadFile = File(None)):
	
	if image_1 == None or image_2 == None:
		return Response(status_code=410)
	
	
	try:
		
		image_1 = await image_1.read()
		image_2 = await image_2.read()
	
		image_1_format = get_format(image_1)
		image_2_format = get_format(image_2)

		if image_1_format == None:
			image_1 = await asyncio.to_thread(convert_to_png, image_1)
			image_1_format = "png"
		if image_2_format == None:
			image_2 = await asyncio.to_thread(convert_to_png, image_2)
			image_2_format = "png"
		
		connection = http.client.HTTPSConnection("api.openai.com")
		connection.request(
				"POST",
				"/v1/chat/completions",
				'{"model":"gpt-5-nano","tools":[{"type":"function","name":"Search trading card","description":"Fetch price and box/series for a card","parameters":{"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}}],"messages":[{"role":"user","content":[{"type":"text","text":"' + prompt + '"},{"type":"image_url","image_url":{"url":"data:image/' + image_1_format + ';base64,' + base64.b64encode(image_1).decode() + '"}},{"type":"image_url","image_url":{"url":"data:image/' + image_2_format + ';base64,' + base64.b64encode(image_2).decode() + '"}}]}]}',
				{"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
			) # max_tokens=200 gpt-4.1-nano gpt-5-nano
		
		print(connection.getresponse().read())
		
		data = await asyncio.to_thread(lambda: json.loads(json.loads(connection.getresponse().read().decode())["choices"][0]["message"]["content"] ))
		
		connection.close()
		
	except:
		return Response(status_code=410)
	
	
	ai_response, image_quality = clean_ai_response(data)
	print(ai_response)
	if ai_response == False:
		return Response(status_code=410)
	
	if image_quality == True or image_quality == False or image_quality == None:
		
		image_1_loaded = Image.open(io.BytesIO(image_1))
		image_2_loaded = Image.open(io.BytesIO(image_2))
		
		print(image_1_loaded.height > image_1_loaded.width)
		
		if image_1_loaded.height > image_1_loaded.width and image_2_loaded.height > image_2_loaded.width:
			
			image_1 = compress(image_1)
			image_2 = compress(image_2)
			
			global image_id
			image_id += 1
			
			image_1_path = os.path.join("C:\\Users\\xzock\\Documents\\Code\\packstorm_webapp\\database\\images", str(image_id) + "_1.webp")
			image_2_path = os.path.join("C:\\Users\\xzock\\Documents\\Code\\packstorm_webapp\\database\\images", str(image_id) + "_2.webp")
			
			with open(image_1_path, "wb") as f:
				f.write(base64.b64decode(image_1))
			with open(image_2_path, "wb") as f:
				f.write(base64.b64decode(image_2))
				
			ai_response["image_1_path"] = image_1_path
			ai_response["image_2_path"] = image_2_path
	
	
	card_id = await asyncio.to_thread( lambda: cards.insert(ai_response) )
	
	token = request.cookies.get("token")
	
	if token == None:
		return data
	
	email = tokens.get(token)
	
	if email == None:
		return data
	
	account = accounts.find_one(email=email)
	
	if account == None:
		return data
	
	
	collection = account.get("collection") or []
	
	collection.append(card_id)
	
	await asyncio.to_thread(lambda: accounts.update({"collection": collection}, ["email"]) )
	
	return data


@app.get("/browse")

async def get_cards(request: Request, response: Response, search: str = "", series: str = "", min_price: int = 0, max_price: int = 999999, offset: int = 0, limit: int = 40):
	
	## Check if user is logged into valid account
	#token = request.cookies.get("token")
	#
	#if token != None:
	#	email = tokens.get(token)
	#else:
	#	return PlainTextResponse("0")
	#
	#account = accounts.find_one(email=email)
	#
	#if email == None or account == None:
	#	return PlainTextResponse("0")
	#
	#subscription_timestamp = account.get("subscription_ts")
	#
	#if int(time.time()) - subscription_timestamp >= 2592000:
	#	return PlainTextResponse("0")
	
	
	# Lazy loading
	all_cards = [dict(card) for card in cards.all()]

	filtered = [
		card for card in all_cards
		if (search == "" or search in card.get("name", "")) == True and
		   (series == "" or series in card.get("series", "")) == True and
		   (card.get("estimated_price") == None or min_price <= card.get("estimated_price", 0) <= max_price) == True
	]

	results = filtered[offset : offset + limit]

	for card in results:
		card.pop("id")

		if card.get("image_1_path"):
			card["image_1_url"] = f"/images/{os.path.basename(card['image_1_path'])}"
		if card.get("image_2_path"):
			card["image_2_url"] = f"/images/{os.path.basename(card['image_2_path'])}"
			
	print(results)

	return results

		#else:
		#
		#    tokens.pop(token, None)
		#    response.delete_cookie(key = "token")
		#
		#    return "0" # This means that your cookie token was expired and you have to log out


@app.put("/signup")

async def signup(body: Request, response: Response): # body = "email,password": string TODO check website that it want me to return

	body = await body.body()
	
	try:

		email_bytes, password_bytes = body.split(b",", 1)
		email = email_bytes.decode()
		password = password_bytes.decode()

	except:
		return Response(status_code=410)
	

	if is_valid_email(email) == True and len(password) > 4 and accounts.find_one(email = email) == None:
		
		verification_codes[email] = [f"{secrets.randbelow(1000000):06d}", int(time.time())]
		print(verification_codes[email])
		
		return Response(status_code=200)
	
	return Response(status_code=410)


@app.put("/verify_code")

async def verify_code(body: Request, response: Response):

	try:
		email_bytes, code_bytes, *password_bytes = (await body.body()).split(b",", 2)
		email = email_bytes.decode()
		code = code_bytes.decode()
		password = password_bytes[0].decode() if password_bytes else None
	except Exception as error:
		print(error)
		return Response(status_code=410)

	if email not in verification_codes:
		return Response(status_code=410)
	
	if password != None: # If signup request
		
		hashed_password = password_hasher.hash(password)
		
		await asyncio.to_thread(lambda: accounts.insert(dict(email = email, hashed_password = hashed_password)) )
	else:
		account = accounts.find_one(email = email)
		
		if account == None:
			return Response(status_code=410)
	
	
	if verification_codes[email][0] != code:
		return Response(status_code=410)
	
	current_timestamp = int(time.time())
	
	if current_timestamp - verification_codes[email][1] > 300:
		return Response(status_code=410)
	
	
	async with verification_lock:
		for email, values in list(verification_codes.items()):
			if current_timestamp - values[1] > 300:
				verification_codes[email] = None
	
	
		
	token = secrets.token_urlsafe(32)
	
	response.set_cookie(
		key = "token",
		value = token,
		httponly = True,
		secure = False,
		samesite = "lax"
	)

	await asyncio.to_thread(lambda: tokens.insert({"email": email, "token": token}) )
	
	
	user_tokens = list(tokens.find(email = email, order_by = "id"))

	if len(user_tokens) > 5:
		
		oldest = user_tokens[:-5]
		
		for row in oldest:
			tokens.delete(id=row["id"])
			
			
	
	if password == None:
		subscription_type = account.get("subscription_type")
		print(subscription_type, account)
		if subscription_type == None:
			print("No sub")
			response.status_code = 200
			return response
		else:
			print(str(subscription_type))
			return PlainTextResponse(str(subscription_type))
	else:
		return Response(status_code=200)



@app.put("/login")

async def login(body: Request, response: Response): # body = "email,password": string

	#body = await body.body()

	try:

		email_bytes, password_bytes = (await body.body()).split(b",", 1)
		email = email_bytes.decode()
		password = password_bytes.decode()

	except Exception as error:
		print(error)
		return Response(status_code=410)
	
	account = accounts.find_one(email = email)
	
	if account == None and is_valid_email(email) == True and len(password) > 4:
		return Response(status_code=410)
	
	
	
	try:
		
		password_hasher.verify(account["hashed_password"], password)
		
	except Exception as error:
		print(error)
		return Response(status_code=410)
	
	verification_codes[email] = [f"{secrets.randbelow(1000000):06d}", int(time.time())]
	print(verification_codes[email])
	return Response(status_code=200)


@app.get("/logout")

async def logout(request: Request, response: Response):

	# Check if user is logged into valid account
	token = request.cookies.get("token")
	
	if token == None:
		return Response(status_code=410)
	
	account_token_data = tokens.find_one(token = token)
	
	if account_token_data == None or account_token_data["email"] == None:
		return Response(status_code=410)
	
	if accounts.find_one(email = account_token_data["email"]) == None:
		return Response(status_code=410)
	
	tokens.delete(token = token)
	response.delete_cookie(key = "token")

	return Response(status_code=200)
