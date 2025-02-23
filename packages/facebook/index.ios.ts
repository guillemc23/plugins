import { ILoginManager } from './common';

function setToArray<T>(value: NSSet<T>): T[] {
	const result = [];
	const nativeObjects = value.allObjects;
	const count = value.count;
	for (let i = 0; i < count; i++) {
		result.push(nativeObjects.objectAtIndex(i));
	}
	return result;
}

export class FacebookError extends Error {
	#native: NSError;
	static fromNative(native: NSError, message?: string) {
		const error = new FacebookError(message || native?.localizedDescription);
		error.#native = native;
		return error;
	}

	get native() {
		return this.#native;
	}
}

let appDelegateInitialized = false;
let appDelegate: FacebookAppDelegateImpl;
@NativeClass
@ObjCClass(UIApplicationDelegate)
class FacebookAppDelegateImpl extends UIResponder implements UIApplicationDelegate {
	static get sharedInstance() {
		if (!appDelegate) {
			appDelegate = FacebookAppDelegateImpl.alloc().init() as FacebookAppDelegateImpl;
		}
		return appDelegate;
	}

	applicationOpenURLOptions(app: UIApplication, url: NSURL, options: NSDictionary<string, any>): boolean {
		return FBSDKApplicationDelegate.sharedInstance.applicationOpenURLOptions(app, url, options);
	}

	applicationOpenURLSourceApplicationAnnotation(application: UIApplication, url: NSURL, sourceApplication: string, annotation: any): boolean {
		return FBSDKApplicationDelegate.sharedInstance.applicationOpenURLSourceApplicationAnnotation(application, url, sourceApplication, annotation);
	}
	applicationDidFinishLaunchingWithOptions(application: UIApplication, launchOptions: NSDictionary<string, any>): boolean {
		return FBSDKApplicationDelegate.sharedInstance.applicationDidFinishLaunchingWithOptions(application, launchOptions);
	}
}

export class AccessToken {
	#native: FBSDKAccessToken;
	#declinedPermissions: string[];
	#expiredPermissions: string[];
	#permissions: string[];
	static fromNative(accessToken: FBSDKAccessToken) {
		if (accessToken instanceof FBSDKAccessToken) {
			const token = new AccessToken();
			token.#native = accessToken;
			return token;
		}
		return null;
	}

	get appID(): string {
		return this.native.appID;
	}

	get dataAccessExpirationDate(): Date {
		return this.native.dataAccessExpirationDate;
	}

	get dataAccessExpired(): boolean {
		return this.native.dataAccessExpired;
	}

	get declinedPermissions(): string[] {
		if (!this.#declinedPermissions) {
			this.#declinedPermissions = setToArray(this.native.declinedPermissions);
		}
		return this.#declinedPermissions;
	}

	get expirationDate(): Date {
		return this.native.expirationDate;
	}

	get expired(): boolean {
		return this.native.expired;
	}

	get expiredPermissions() {
		if (!this.#expiredPermissions) {
			this.#expiredPermissions = setToArray(this.native.expiredPermissions);
		}
		return this.#expiredPermissions;
	}

	get graphDomain(): string {
		return this.native.graphDomain;
	}

	get permissions(): string[] {
		if (!this.#permissions) {
			this.#permissions = setToArray(this.native.permissions);
		}
		return this.#permissions;
	}

	get refreshDate(): Date {
		return this.native.refreshDate;
	}

	get tokenString(): string {
		return this.native.tokenString;
	}

	get userID(): string {
		return this.native.userID;
	}

	get native() {
		return this.#native;
	}

	get ios() {
		return this.native;
	}

	static currentAccessToken(): AccessToken {
		return AccessToken.fromNative(FBSDKAccessToken.currentAccessToken);
	}

	static get currentAccessTokenIsActive(): boolean {
		return FBSDKAccessToken.currentAccessTokenIsActive;
	}
}

export class LoginResult {
	#native: FBSDKLoginManagerLoginResult;
	#token: AccessToken;
	#declinedPermissions: string[];
	#grantedPermissions: string[];

	static fromNative(logingResult: FBSDKLoginManagerLoginResult) {
		if (logingResult instanceof FBSDKLoginManagerLoginResult) {
			const result = new LoginResult();
			result.#native = logingResult;
			return result;
		}
		return null;
	}

	get declinedPermissions(): string[] {
		if (!this.#declinedPermissions) {
			this.#declinedPermissions = setToArray(this.native.declinedPermissions);
		}
		return this.#declinedPermissions;
	}

	get grantedPermissions(): string[] {
		if (!this.#grantedPermissions) {
			this.#grantedPermissions = setToArray(this.native.grantedPermissions);
		}
		return this.#grantedPermissions;
	}

	get isCancelled(): boolean {
		return this.native.isCancelled;
	}

	get token(): AccessToken {
		if (!this.#token) {
			this.#token = AccessToken.fromNative(this.native.token);
		}
		return this.#token;
	}

	get native() {
		return this.#native;
	}

	get ios() {
		return this.native;
	}
}

export class LoginManager implements ILoginManager {
	static #native: FBSDKLoginManager;
	static init() {
		if (!this.#native) {
			this.#native = FBSDKLoginManager.new();
		}

		if (!appDelegateInitialized) {
			GULAppDelegateSwizzler.proxyOriginalDelegate();
			GULAppDelegateSwizzler.registerAppDelegateInterceptor(FacebookAppDelegateImpl.sharedInstance);
			appDelegateInitialized = true;
		}
	}

	static logInWithPermissions(permissions: string[]): Promise<LoginResult> {
		return new Promise((resolve, reject) => {
			this.#native.logInWithPermissionsFromViewControllerHandler(permissions, this.topViewController, (result, error) => {
				if (error) {
					reject(FacebookError.fromNative(error));
				} else {
					resolve(LoginResult.fromNative(result));
				}
			});
		});
	}

	static logout() {
		this.#native.logOut();
	}

	private static get topViewController(): UIViewController | undefined {
		const root = this.rootViewController;
		if (!root) {
			return undefined;
		}
		return this.findTopViewController(root);
	}

	private static get rootViewController(): UIViewController | undefined {
		const keyWindow = UIApplication.sharedApplication.keyWindow;
		return keyWindow ? keyWindow.rootViewController : undefined;
	}

	private static findTopViewController(root: UIViewController): UIViewController | undefined {
		const presented = root.presentedViewController;
		if (presented != null) {
			return this.findTopViewController(presented);
		}
		if (root instanceof UISplitViewController) {
			const last = root.viewControllers.lastObject;
			if (last == null) {
				return root;
			}
			return this.findTopViewController(last);
		} else if (root instanceof UINavigationController) {
			const top = root.topViewController;
			if (top == null) {
				return root;
			}
			return this.findTopViewController(top);
		} else if (root instanceof UITabBarController) {
			const selected = root.selectedViewController;
			if (selected == null) {
				return root;
			}
			return this.findTopViewController(selected);
		} else {
			return root;
		}
	}
}
