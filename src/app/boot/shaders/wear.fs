#if defined(VERTEX) || __VERSION__ > 100 || defined(GL_FRAGMENT_PRECISION_HIGH)
	#define MY_HIGHP_OR_MEDIUMP highp
#else
	#define MY_HIGHP_OR_MEDIUMP mediump
#endif


// BalatroItemService's items: how worn a card is (x: 0 pristine ... 1 ruined) and its own seed (y), so that
// each item has its own grime, scratches and frayed edges. Drawn over the card: faded colours, dirt, scratches.
extern MY_HIGHP_OR_MEDIUMP vec2 wear;
extern MY_HIGHP_OR_MEDIUMP number dissolve;
extern MY_HIGHP_OR_MEDIUMP number time;
extern MY_HIGHP_OR_MEDIUMP vec4 texture_details;
extern MY_HIGHP_OR_MEDIUMP vec2 image_details;
extern bool shadow;
extern MY_HIGHP_OR_MEDIUMP vec4 burn_colour_1;
extern MY_HIGHP_OR_MEDIUMP vec4 burn_colour_2;

vec4 dissolve_mask(vec4 tex, vec2 texture_coords, vec2 uv)
{
    if (dissolve < 0.001) {
        return vec4(shadow ? vec3(0.,0.,0.) : tex.xyz, shadow ? tex.a*0.3: tex.a);
    }

    float adjusted_dissolve = (dissolve*dissolve*(3.-2.*dissolve))*1.02 - 0.01; //Adjusting 0.0-1.0 to fall to -0.1 - 1.1 scale so the mask does not pause at extreme values

	float t = time * 10.0 + 2003.;
	vec2 floored_uv = (floor((uv*texture_details.ba)))/max(texture_details.b, texture_details.a);
    vec2 uv_scaled_centered = (floored_uv - 0.5) * 2.3 * max(texture_details.b, texture_details.a);
	
	vec2 field_part1 = uv_scaled_centered + 50.*vec2(sin(-t / 143.6340), cos(-t / 99.4324));
	vec2 field_part2 = uv_scaled_centered + 50.*vec2(cos( t / 53.1532),  cos( t / 61.4532));
	vec2 field_part3 = uv_scaled_centered + 50.*vec2(sin(-t / 87.53218), sin(-t / 49.0000));

    float field = (1.+ (
        cos(length(field_part1) / 19.483) + sin(length(field_part2) / 33.155) * cos(field_part2.y / 15.73) +
        cos(length(field_part3) / 27.193) * sin(field_part3.x / 21.92) ))/2.;
    vec2 borders = vec2(0.2, 0.8);

    float res = (.5 + .5* cos( (adjusted_dissolve) / 82.612 + ( field + -.5 ) *3.14))
    - (floored_uv.x > borders.y ? (floored_uv.x - borders.y)*(5. + 5.*dissolve) : 0.)*(dissolve)
    - (floored_uv.y > borders.y ? (floored_uv.y - borders.y)*(5. + 5.*dissolve) : 0.)*(dissolve)
    - (floored_uv.x < borders.x ? (borders.x - floored_uv.x)*(5. + 5.*dissolve) : 0.)*(dissolve)
    - (floored_uv.y < borders.x ? (borders.x - floored_uv.y)*(5. + 5.*dissolve) : 0.)*(dissolve);

    if (tex.a > 0.01 && burn_colour_1.a > 0.01 && !shadow && res < adjusted_dissolve + 0.8*(0.5-abs(adjusted_dissolve-0.5)) && res > adjusted_dissolve) {
        if (!shadow && res < adjusted_dissolve + 0.5*(0.5-abs(adjusted_dissolve-0.5)) && res > adjusted_dissolve) {
            tex.rgba = burn_colour_1.rgba;
        } else if (burn_colour_2.a > 0.01) {
            tex.rgba = burn_colour_2.rgba;
        }
    }

    return vec4(shadow ? vec3(0.,0.,0.) : tex.xyz, res > adjusted_dissolve ? (shadow ? tex.a*0.3: tex.a) : .0);
}

float wear_hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float wear_noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f*f*(3. - 2.*f);
    return mix(mix(wear_hash(i), wear_hash(i + vec2(1., 0.)), f.x),
               mix(wear_hash(i + vec2(0., 1.)), wear_hash(i + vec2(1., 1.)), f.x), f.y);
}

vec4 effect( vec4 colour, Image texture, vec2 texture_coords, vec2 screen_coords )
{
    vec4 tex = Texel(texture, texture_coords);
    vec2 uv = (((texture_coords)*(image_details)) - texture_details.xy*texture_details.ba)/texture_details.ba;
    number w = clamp(wear.x, 0., 1.);
    number s = wear.y;
    if (tex.a < 0.01 || w < 0.003) return vec4(0., 0., 0., 0.);

    // the card's own pixels (71 x 95), so the wear is as pixelated as the art
    vec2 size = texture_details.ba;
    vec2 cell = floor(uv*size);

    // faded, yellowed colours
    number grey = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
    vec3 aged = vec3(grey*1.05 + 0.08, grey*0.92 + 0.05, grey*0.66 + 0.01);
    number fade = 0.82*w;

    // grime: blotches that grow with the wear
    number n = 0.65*wear_noise(cell*0.11 + s*13.) + 0.35*wear_noise(cell*0.37 + s*7.);
    number grime = smoothstep(0.62 - 0.4*w, 0.92 - 0.2*w, n)*w;
    vec3 dirt = vec3(0.30, 0.22, 0.15);

    // scratches: a few straight lines, more of them on a more worn card
    number scratch = 0.;
    for (int k = 0; k < 7; k++) {
        number fk = float(k);
        if (wear_hash(vec2(s, fk)) < w*1.3 - 0.1) {
            number ang = 6.2831*wear_hash(vec2(fk + 1.7, s));
            vec2 dir = vec2(cos(ang), sin(ang));
            vec2 o = vec2(wear_hash(vec2(fk + 3.1, s)), wear_hash(vec2(s, fk + 4.3)))*size;
            vec2 d = cell - o;
            number across = abs(dot(d, vec2(-dir.y, dir.x)));
            number along = abs(dot(d, dir));
            number len = 6. + 26.*wear_hash(vec2(fk, s + 5.9));
            scratch = max(scratch, step(across, 0.55)*step(along, len)*step(0.25, wear_hash(cell + fk)));
        }
    }

    // frayed edges and corners: whitened pixels along the border
    vec2 e = min(cell, size - 1. - cell);
    number border = min(e.x, e.y);
    number corner = length(max(vec2(4.) - e, vec2(0.)));
    number fray = step(border, 0.5 + 2.5*w)*step(1. - w*0.9, wear_hash(cell*1.37 + s))
                + step(3.2 - 2.*w, corner)*step(0.35, w);

    // a crease across the card once it is badly worn
    number crease_ang = 0.6 + 1.9*wear_hash(vec2(s, 9.1));
    vec2 crease_dir = vec2(cos(crease_ang), sin(crease_ang));
    number crease = step(0.45, w)*step(abs(dot(cell - 0.5*size, vec2(-crease_dir.y, crease_dir.x))), 0.5)
                  *step(0.3, wear_hash(cell + 2.2));

    vec3 col = mix(aged, dirt, grime);
    number light = clamp(max(scratch*0.85, max(fray, crease*0.6)), 0., 1.);
    col = mix(col, vec3(0.93, 0.91, 0.86), light);
    number a = clamp(max(fade, max(grime*0.9, light*(0.45 + 0.55*w))), 0., 1.);
    return dissolve_mask(vec4(col, tex.a*a), texture_coords, uv);
}

extern MY_HIGHP_OR_MEDIUMP vec2 mouse_screen_pos;
extern MY_HIGHP_OR_MEDIUMP float hovering;
extern MY_HIGHP_OR_MEDIUMP float screen_scale;

#ifdef VERTEX
vec4 position( mat4 transform_projection, vec4 vertex_position )
{
    if (hovering <= 0.){
        return transform_projection * vertex_position;
    }
    float mid_dist = length(vertex_position.xy - 0.5*love_ScreenSize.xy)/length(love_ScreenSize.xy);
    vec2 mouse_offset = (vertex_position.xy - mouse_screen_pos.xy)/screen_scale;
    float scale = 0.2*(-0.03 - 0.3*max(0., 0.3-mid_dist))
                *hovering*(length(mouse_offset)*length(mouse_offset))/(2. -mid_dist);

    return transform_projection * vertex_position + vec4(0,0,0,scale);
}
#endif