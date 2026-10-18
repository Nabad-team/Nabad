// One test account per virtual user, the same one every round: thread N of a thread group (counted from 0)
// takes line offset+N+1 of the CSV (line 0 is the header). The offset (the script's parameter) keeps two
// thread groups apart, e.g. the spike group starts after the base group's accounts. Two users never share
// an account, so one user's logout (which ends that account's other sessions) never signs another user out.
if (vars.get('email') != null) return

def accounts = props.get('nabad.accounts')
if (accounts == null) {
  synchronized (props) {
    accounts = props.get('nabad.accounts')
    if (accounts == null) {
      def file = new File(vars.get('users_csv'))
      if (!file.absolute) file = new File(org.apache.jmeter.services.FileServer.getFileServer().getBaseDir(), file.path)
      accounts = file.readLines('UTF-8').drop(1).findAll { it.trim() }.collect { it.split(',', 2) }
      props.put('nabad.accounts', accounts)
    }
  }
}
int n = (args ? args[0] as int : 0) + ctx.getThreadNum()
if (n >= accounts.size()) {
  log.error("users.csv has only ${accounts.size()} accounts; user ${n + 1} has none. Seed more with seed-users.js.")
  ctx.getThread().stop()
  return
}
vars.put('email', accounts[n][0].trim())
vars.put('password', accounts[n][1].trim())
