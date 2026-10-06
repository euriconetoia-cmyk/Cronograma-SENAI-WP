<?php
/**
 * Tela de entrada (visual "C": cartão claro, luz que segue o mouse, barras de etapas) com a identidade da Unidigit@l e encaminhamento de cada perfil.
 *
 * - Quem entra com acesso ao sistema vai direto para o Cronograma (administradores do site continuam indo ao painel).
 * - Unidades e consulta não veem a barra do WordPress nem o painel; só podem trocar a senha em "Perfil".
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Cronograma_EAD_Login {

	public static function hooks() {
		add_action( 'login_enqueue_scripts', array( __CLASS__, 'estilo' ) );
		add_filter( 'login_headertext', function () {
			return 'SENAI · Sistema de cronogramas EaD';
		} );
		add_filter( 'login_headerurl', function () {
			return home_url( '/' );
		} );
		add_filter( 'login_message', array( __CLASS__, 'mensagem' ) );
		add_filter( 'login_errors', array( __CLASS__, 'erros' ) );
		add_action( 'login_init', function () {
			// Título, "Voltar para …" e e-mails de senha usam Unidigit@l em vez do nome do site.
			add_filter( 'pre_option_blogname', function () {
				return 'Unidigit@l';
			} );
			add_filter( 'gettext', array( __CLASS__, 'traduzir' ), 10, 3 );
			add_filter( 'gettext_with_context', array( __CLASS__, 'traduzir_ctx' ), 10, 4 );
		} );
		add_action( 'login_form', array( __CLASS__, 'link_senha' ) );
		add_action( 'login_footer', array( __CLASS__, 'movimento' ) );
		add_filter( 'login_redirect', array( __CLASS__, 'destino' ), 10, 3 );
		add_action( 'admin_init', array( __CLASS__, 'fechar_painel' ) );
		add_filter( 'show_admin_bar', array( __CLASS__, 'barra' ) );
	}

	public static function estilo() {
		echo str_replace( '%LOGO%', esc_url( CRONOGRAMA_EAD_URL . 'assets/img/senai-logo.png' ), '<style id="ce-login">
:root{--az:#0a4ba0;--az2:#0077f2;--tx:#1d2733;--mut:#6b7785}
body.login{background:#f6f8fb;color:var(--tx);font-family:"Inter","Segoe UI",system-ui,-apple-system,Roboto,Arial,sans-serif;display:flex;align-items:center;min-height:100vh;padding:24px 0;position:relative;overflow-x:hidden}
body.login::before{content:"";position:fixed;inset:0;pointer-events:none;background:radial-gradient(520px 320px at var(--x,50%) var(--y,35%),rgba(0,119,242,.16),transparent 70%);transition:background .15s}
body.login #login{position:relative;width:100%;max-width:420px;padding:34px 34px 26px;margin:0 auto;background:#fff;border-radius:16px;box-shadow:0 14px 40px rgba(10,75,160,.14);box-sizing:border-box;animation:ce-ent .7s cubic-bezier(.2,.8,.2,1) both}
@keyframes ce-ent{from{opacity:0;transform:translateY(24px)}}
body.login #login.ce-shake{animation:ce-sh .4s}
@keyframes ce-sh{20%,60%{transform:translateX(-7px)}40%,80%{transform:translateX(7px)}}
body.login #login h1{margin:0 0 6px}
body.login #login h1 a{background:url(%LOGO%) left center/contain no-repeat;text-indent:-9999px;overflow:hidden;width:150px;height:40px;margin:0;box-shadow:none;display:block}
body.login #login h1:after{content:"Cronogramas EaD";display:block;text-align:left;font-size:22px;font-weight:700;color:var(--tx);margin-top:4px}
body.login #login .ce-linha{display:flex;gap:8px;margin:16px 0 22px!important}
.ce-linha span{flex:1;height:6px;border-radius:3px;background:#e1e8f2;overflow:hidden;position:relative}
.ce-linha span:after{content:"";position:absolute;inset:0;background:var(--az2);transform:translateX(-100%);animation:ce-enc 3.6s infinite}
.ce-linha span:nth-child(2):after{animation-delay:.5s}.ce-linha span:nth-child(3):after{animation-delay:1s}
@keyframes ce-enc{40%,70%{transform:none}100%{transform:translateX(100%)}}
/* formulário sem moldura: o cartão é o #login */
body.login form{background:none;border:0;border-radius:0;padding:0;margin:0;box-shadow:none;display:flex;flex-wrap:wrap;align-items:center}
body.login form>p,body.login form>div{width:100%}
body.login form label{display:block;font-size:12px;font-weight:500;color:var(--mut);margin:0 0 2px;transition:color .2s}
body.login form p:focus-within>label,body.login form .user-pass-wrap:focus-within>label{color:var(--az2)}
body.login form>p:not(.forgetmenot):not(.submit):not(.ce-lost),body.login form .user-pass-wrap{position:relative;margin:0 0 28px!important}
body.login form>p:not(.forgetmenot):not(.submit):not(.ce-lost):after,body.login form .user-pass-wrap:after{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;background:var(--az2);transform:scaleX(0);transform-origin:left;transition:transform .35s}
body.login form>p:not(.forgetmenot):not(.submit):not(.ce-lost):focus-within:after,body.login form .user-pass-wrap:focus-within:after{transform:scaleX(1)}
body.login form .input,body.login input[type=text],body.login input[type=password],body.login input[type=email]{height:40px;box-sizing:border-box;width:100%;font-size:16px;color:var(--tx);background:transparent;border:0;border-bottom:2px solid #cbd3de;border-radius:0;padding:0 40px 0 0;margin:0;box-shadow:none;outline:0}
body.login form .input:focus,body.login input[type=text]:focus,body.login input[type=password]:focus,body.login input[type=email]:focus{border-bottom-color:#cbd3de;box-shadow:none}
body.login .user-pass-wrap .wp-pwd{position:relative}
body.login .wp-pwd .button.wp-hide-pw{position:absolute;right:0;top:0;height:40px;width:36px;min-height:0;color:#7a8696;background:transparent;border:0;box-shadow:none}
body.login .wp-pwd .button.wp-hide-pw:hover,body.login .wp-pwd .button.wp-hide-pw:focus{color:var(--az2);background:transparent;box-shadow:none;outline:0}
body.login form .forgetmenot{order:3;float:none;margin:0 0 24px!important;width:50%;box-sizing:border-box}
body.login form .forgetmenot label{font-size:14px;margin:0;color:var(--tx);display:inline-flex;align-items:center;gap:8px}
body.login form .ce-lost{order:4;width:50%;box-sizing:border-box;text-align:right;margin:0 0 24px!important;font-size:14px}
body.login form .ce-lost a{color:var(--az);text-decoration:none;font-weight:500}
body.login form .ce-lost a:hover{text-decoration:underline}
body.login form .submit{order:5;width:100%;margin:8px 0 0!important}
body.login form input[type=checkbox]{appearance:none;-webkit-appearance:none;width:20px;height:20px;min-width:20px;margin:0;border:2px solid #aab6c6;border-radius:5px;background:#fff;box-shadow:none;position:relative;cursor:pointer;transition:background .2s,border-color .2s}
body.login form input[type=checkbox]:checked{background:var(--az2);border-color:var(--az2)}
body.login form input[type=checkbox]:checked::before{content:"";position:absolute;left:5px;top:1px;width:5px;height:10px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg);margin:0;background:none}
body.login form input[type=checkbox]:focus{box-shadow:0 0 0 3px rgba(0,119,242,.25);outline:0}
body.login .button-primary,body.login #wp-submit{position:relative;overflow:hidden;float:none;display:block;width:100%;min-width:0;height:48px;padding:0;font-size:14px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#fff;background:var(--az2);border:0;border-radius:8px;box-shadow:none;text-shadow:none;cursor:pointer;transition:transform .15s,box-shadow .2s}
body.login .button-primary:hover,body.login #wp-submit:hover{background:var(--az2);color:#fff;box-shadow:0 8px 18px rgba(0,119,242,.33);transform:translateY(-1px)}
body.login .button-primary:focus,body.login #wp-submit:focus{background:var(--az2);color:#fff;box-shadow:0 0 0 3px rgba(0,119,242,.3);outline:0}
body.login .button-primary:active,body.login #wp-submit:active{transform:scale(.98)}
body.login #wp-submit .ce-onda{position:absolute;border-radius:50%;background:rgba(255,255,255,.4);transform:scale(0);animation:ce-rip .6s linear;pointer-events:none}
@keyframes ce-rip{to{transform:scale(5);opacity:0}}
body.login #wp-submit.ce-carr:after{content:"";display:inline-block;width:14px;height:14px;margin-left:10px;vertical-align:-2px;border:2px solid #fff;border-right-color:transparent;border-radius:50%;animation:ce-gira .7s linear infinite}
@keyframes ce-gira{to{transform:rotate(360deg)}}
body.login .message,body.login .success,body.login #login_error{border:0;border-left:4px solid var(--az2);border-radius:8px;background:#f1f6fd;color:var(--tx);box-shadow:none;margin:0 0 18px;padding:12px 14px;font-size:14px}
body.login #login_error{border-left-color:#b42318;background:#fdf1f0;color:#7a1712}
body.login #nav,body.login #backtoblog{text-align:center;padding:0;margin:16px 0 0;font-size:14px}
body.login #nav a,body.login #backtoblog a{color:var(--az);text-decoration:none;font-weight:500}
body.login #nav a:hover,body.login #backtoblog a:hover{text-decoration:underline}
body.login .privacy-policy-page-link{display:none}
body.login.login-action-login #nav{display:none}
@media (max-width:480px){body.login #login{max-width:none;margin:0 16px;padding:26px 22px 22px}body.login form .forgetmenot,body.login form .ce-lost{width:100%;text-align:left;margin:0 0 14px}}
@media (prefers-reduced-motion:reduce){body.login *,body.login #login,.ce-linha span:after{animation:none!important;transition:none!important}}
</style>' );
	}

	/** Mensagens de erro de entrada em português e sem revelar se o usuário existe. */
	public static function erros( $erro ) {
		if ( false !== stripos( $erro, 'password' ) || false !== stripos( $erro, 'username' ) || false !== stripos( $erro, 'Unknown email' ) ) {
			return '<strong>Usuário ou senha incorretos.</strong> Confira os dados ou use &ldquo;Esqueceu a senha?&rdquo;.';
		}
		return $erro;
	}

	/** Movimento da tela de entrada: brilho que segue o mouse, barras de etapas, onda no botão e balanço no erro. */
	public static function movimento() {
		echo '<script id="ce-login-js">(function(){var d=document,b=d.body,l=d.getElementById("login");if(!l)return;
var h=l.querySelector("h1");if(h&&!l.querySelector(".ce-linha")){var n=d.createElement("div");n.className="ce-linha";n.innerHTML="<span></span><span></span><span></span>";h.insertAdjacentElement("afterend",n)}
d.addEventListener("mousemove",function(e){b.style.setProperty("--x",e.clientX+"px");b.style.setProperty("--y",e.clientY+"px")});
var s=d.getElementById("wp-submit");if(s){s.addEventListener("click",function(e){var r=s.getBoundingClientRect(),o=d.createElement("span");o.className="ce-onda";o.style.cssText="width:40px;height:40px;left:"+(e.clientX-r.left-20)+"px;top:"+(e.clientY-r.top-20)+"px";s.appendChild(o);setTimeout(function(){o.remove()},600)});var f=d.getElementById("loginform");if(f)f.addEventListener("submit",function(){s.classList.add("ce-carr")})}
if(d.getElementById("login_error")){l.classList.add("ce-shake")}})();</script>';
	}

	/** Troca os textos do formulário de entrada para o português, qualquer que seja o idioma do site. */
	public static function traduzir( $traduzido, $texto, $dominio ) {
		static $mapa = array(
			'Username or Email Address' => 'Usuário ou e-mail',
			'Password'                  => 'Senha',
			'Remember Me'               => 'Lembrar de mim',
			'Log In'                    => 'Entrar',
			'Lost your password?'       => 'Esqueceu a senha?',
			'Get New Password'          => 'Receber nova senha',
			'Username or Email Address ' => 'Usuário ou e-mail',
			'Show password'             => 'Mostrar senha',
			'Hide password'             => 'Ocultar senha',
			'Log in'                    => 'Entrar',
			'Back'                      => 'Voltar',
		);
		return ( 'default' === $dominio && isset( $mapa[ $texto ] ) ) ? $mapa[ $texto ] : $traduzido;
	}

	public static function traduzir_ctx( $traduzido, $texto, $contexto, $dominio ) {
		if ( 'default' === $dominio && '&larr; Go to %s' === $texto ) {
			return '&larr; Voltar para %s';
		}
		return $traduzido;
	}

	/** "Esqueceu a senha?" ao lado de "Lembrar de mim", como no desenho. */
	public static function link_senha() {
		echo '<p class="ce-lost"><a href="' . esc_url( wp_lostpassword_url() ) . '">' . esc_html__( 'Lost your password?' ) . '</a></p>';
	}

	public static function mensagem( $msg ) {
		return $msg . '<p class="message" style="border-left-color:#0b2a4d">Entre com o usuário e a senha que a Unidigit@l enviou para você.</p>';
	}

	private static function perfil_do_usuario( $user ) {
		return ( $user instanceof WP_User ) ? Cronograma_EAD_Service::perfil( $user->ID ) : '';
	}

	public static function destino( $redirect_to, $requested, $user ) {
		if ( ! ( $user instanceof WP_User ) || '' === self::perfil_do_usuario( $user ) || user_can( $user, 'manage_options' ) ) {
			return $redirect_to;
		}
		$urls = Cronograma_EAD_Pages::urls();
		$sist = isset( $urls['inicio'] ) ? $urls['inicio'] : ( isset( $urls['cronograma'] ) ? $urls['cronograma'] : '' );
		$pediu_painel = ( '' === (string) $requested ) || false !== strpos( (string) $requested, 'wp-admin' );
		return ( $sist && $pediu_painel ) ? $sist : $redirect_to;
	}

	private static function so_sistema() {
		if ( ! is_user_logged_in() ) {
			return false;
		}
		return in_array( Cronograma_EAD_Service::perfil(), array( 'unidade', 'consulta' ), true ) && ! current_user_can( 'edit_posts' );
	}

	public static function barra( $mostrar ) {
		return self::so_sistema() ? false : $mostrar;
	}

	public static function fechar_painel() {
		if ( ! self::so_sistema() || wp_doing_ajax() ) {
			return;
		}
		$arq = isset( $_SERVER['PHP_SELF'] ) ? basename( (string) $_SERVER['PHP_SELF'] ) : ''; // phpcs:ignore
		if ( in_array( $arq, array( 'profile.php', 'admin-post.php', 'admin-ajax.php', 'async-upload.php' ), true ) ) {
			return;
		}
		$urls = Cronograma_EAD_Pages::urls();
		wp_safe_redirect( isset( $urls['cronograma'] ) ? $urls['cronograma'] : home_url( '/' ) );
		exit;
	}
}
