import ProfileSettings from '../settings/ProfileSettings';

// SME uses the shared settings page with its own profile / password endpoints.
const SmeSettings = () => (
    <ProfileSettings workspace="SME WORKSPACE" profileUrl="/sme/profile" passwordUrl="/sme/password" />
);

export default SmeSettings;
