CREATE TABLE "control_account" (
	"email" text NOT NULL,
	"url" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"token_expiry" bigint,
	"active" boolean NOT NULL,
	"time_created" bigint NOT NULL,
	"time_updated" bigint NOT NULL,
	CONSTRAINT "control_account_pk" PRIMARY KEY("email", "url")
);
